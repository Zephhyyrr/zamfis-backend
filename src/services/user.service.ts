import prisma from "../config/prisma";
import { AppError } from "../errors/api_errors";
import { RoleUser } from "@prisma/client";
import { getPagination, getPagingData } from "../utils/pagination";
import { hashing } from "../utils/bcrypt";
import { generateToken } from "../utils/jwt";
import { transporter } from "../config/mail";
import { verifyEmailTemplate } from "../templates/email/verify_email";

const userResponseSelect = {
    id: true,
    email: true,
    nama: true,
    role: true,
    fotoProfile: true,
    isActive: true,
    isVerified: true,
    createdAt: true,
    updatedAt: true
} as const;

export async function getAllUserService(page: number, limit: number) {
    const { skip, take, pageNumber, pageSize } = getPagination(page, limit);
    const users = await prisma.user.findMany({
        skip,
        take,
        where: { isDeleted: false },
        select: {
            ...userResponseSelect
        }
    });

    const totalItems = await prisma.user.count({
        where: { isDeleted: false }
    });
    const meta = getPagingData(totalItems, pageNumber, pageSize);
    return {
        data: users,
        meta: meta
    };
}



export async function getByIdService(params: { id: number }) {
    const { id } = params;
    const user = await prisma.user.findUnique({
        where: { id: Number(id) },
        select: userResponseSelect
    });
    return user;
}

export async function getUserByIdService(id: number) {
    const user = await prisma.user.findUnique({
        where: { id: Number(id) },
        select: userResponseSelect
    });
    return user;
}

export async function createUserService(
    email: string,
    nama: string,
    password: string,
    role: RoleUser,
    fotoProfile?: string
) {
    const existingUser = await existsEmail(email);
    if (existingUser) {
        throw new AppError("Email sudah digunakan.");
    }

    const hashedPassword = await hashing(password);
    if (!hashedPassword) {
        throw new AppError("Terjadi kesalahan saat memproses password.");
    }

    const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
            data: {
                email,
                nama,
                password: hashedPassword,
                role,
                fotoProfile
            },
            select: userResponseSelect
        });

        const token = await generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            nama: user.nama
        });

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await tx.userToken.create({
            data: {
                userId: user.id,
                token: token,
                expiresAt: expiresAt
            }
        });

        return { user, token };
    });

    try {
        await sendVerificationEmail(result.user.email, result.user.nama, result.token);
    } catch (error) {
        console.error(error);
    }

    return result.user;
}

export async function updateUserService(
    id: number,
    email: string,
    nama: string,
    role: string,
    password?: string
) {
    const parsedRole = role as RoleUser;

    if (!Object.values(RoleUser).includes(parsedRole)) {
        throw new Error("Role tidak valid.");
    }

    const data: {
        email: string;
        nama: string;
        role: RoleUser;
        password?: string;
    } = {
        email,
        nama,
        role: parsedRole,
    };

    if (password) {
        const hashedPassword = await hashing(password);
        if (hashedPassword) {
            data.password = hashedPassword;
        }
    }

    const updated = await prisma.user.update({
        where: { id },
        data,
        select: userResponseSelect
    });

    return updated;
}

export async function userActiveService(id: number) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
        throw new AppError(`User dengan id: ${id}, tidak tersedia.`);
    }

    const newActiveStatus = !user.isActive;

    const updatedUser = await prisma.user.update({
        where: { id },
        data: {
            isActive: newActiveStatus,
            isVerified: false
        },
        select: userResponseSelect
    });

    await prisma.userToken.deleteMany({ where: { userId: id } });

    if (newActiveStatus) {
        const token = await generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            nama: user.nama
        });

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await prisma.userToken.create({
            data: {
                userId: user.id,
                token,
                expiresAt
            }
        });

        try {
            await sendVerificationEmail(updatedUser.email, updatedUser.nama, token);
        } catch (error) {
            console.error("Gagal mengirim ulang email verifikasi:", error);
        }
    }

    return {
        user: updatedUser,
        action: newActiveStatus ? "activate" : "deactivate"
    };
}

export async function deleteUserService(id: number) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
        throw new AppError(`User dengan id: ${id}, tidak tersedia.`);
    }

    const newDeletedStatus = !user.isDeleted;

    const result = await prisma.user.update({
        where: { id },
        data: {
            isDeleted: newDeletedStatus,
            isActive: !newDeletedStatus,
            isVerified: false
        },
        select: userResponseSelect
    });

    if (!newDeletedStatus) {
        const token = await generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            nama: user.nama
        });

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await prisma.userToken.deleteMany({ where: { userId: id } });

        await prisma.userToken.create({
            data: {
                userId: user.id,
                token: token,
                expiresAt: expiresAt
            }
        });

        try {
            await sendVerificationEmail(result.email, result.nama, token);
        } catch (error) {
            // Log error jika pengiriman email gagal
        }
    }

    return {
        user: result,
        action: newDeletedStatus ? 'delete' : 'undelete'
    };
}



const findUserById = async (id: number) => {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user || user.isDeleted) throw new AppError(`User dengan id: ${id}, tidak tersedia.`)

    return user
}

export async function updatePhotoProfileService(params: { id: number; fotoProfile: string }) {
    const { id, fotoProfile } = params;
    await findUserById(id);
    const updated = await prisma.user.update({
        where: { id },
        data: { fotoProfile },
        select: userResponseSelect
    });
    return updated;
}

const sendVerificationEmail = async (email: string, nama: string, token: string) => {
    const backendBaseUrl = process.env.API_BACKEND || "https://api.surauzamzam.my.id";
    const verifyUrl = new URL("/api/auth/verify-email", backendBaseUrl);
    verifyUrl.searchParams.set("token", token);

    const htmlContent = verifyEmailTemplate(nama, verifyUrl.toString());
    const mailOptions = {
        from: `"Surau Zam-Zam" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Verifikasi Email - Surau Zam-Zam",
        html: htmlContent,
        attachments: [
            {
                filename: 'zamfis_logo.png',
                path: process.cwd() + '/src/templates/assets/zamfis_logo.png',
                cid: 'zamfis_logo'
            }
        ]
    };

    await transporter.sendMail(mailOptions);
};

export async function existsEmail(email: string, ignoreId?: number) {
    const whereClause: any = { email }

    if (ignoreId) { whereClause.id = { not: ignoreId } }

    const existtingEmail = await prisma.user.findFirst({
        where: whereClause
    })

    return existtingEmail
}
