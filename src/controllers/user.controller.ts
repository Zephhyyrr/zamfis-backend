import { Request, Response } from "express";
import { ResponseApiType } from "../types/api_types";
import { 
    createUserService, 
    deleteUserService, 
    getAllUserService,
    getUserByIdService,
    updateUserService, 
    updatePhotoProfileService,
    userActiveService
} from "../services/user.service";
import { handlerAnyError } from "../errors/api_errors";

export async function getAlluserController(req: Request, res: Response<ResponseApiType>) {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;

        const result = await getAllUserService(page, limit);
        return res.status(200).json({
            success: true,
            message: "Berhasil mendapatkan daftar user.",
            data: result.data,
            meta: result.meta
        });
    } catch (error) {
        return handlerAnyError(error, res);
    }
}



export async function getUserByIdController(req: Request, res: Response<ResponseApiType>) {
    try {
        const { id } = req.params;
        const user = await getUserByIdService(Number(id));
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User tidak ditemukan dengan ID " + id
            });
        }

        return res.status(200).json({
            success: true,
            message: "Berhasil mendapatkan user. atas nama " + user.nama,
            data: user
        });
    } catch (error) {
        return handlerAnyError(error, res);
    }
}

export async function createUserController(req: Request, res: Response<ResponseApiType>) {
    try {
        const { email, nama, password, role, fotoProfile } = req.body;

        const newUser = await createUserService(email, nama, password, role, fotoProfile);
        
        return res.status(201).json({
            success: true,
            message: `Berhasil menambahkan user: ${newUser.nama}. Silakan cek email untuk verifikasi.`,
            data: newUser
        });
    } catch (error) {
        return handlerAnyError(error, res);
    }
}

export async function updateUserController(req: Request, res: Response<ResponseApiType>) {
    try {
        const { id } = req.params;
        const { email, nama, role, password } = req.body;

        const targetUser = await getUserByIdService(Number(id));
        if (targetUser?.email === 'pengurussurauzamzam@gmail.com' && req.user?.email !== 'pengurussurauzamzam@gmail.com') {
            return res.status(403).json({
                success: false,
                message: "Akun utama (pengurussurauzamzam@gmail.com) hanya dapat diubah oleh pemilik akun tersebut."
            });
        }


        const updatedUser = await updateUserService(Number(id), email, nama, role, password);
        
        return res.status(200).json({
            success: true,
            message: `Berhasil mengupdate user: ${updatedUser.nama}.`,
            data: updatedUser
        });
    } catch (error) {
        return handlerAnyError(error, res);
    }
}

export async function toggleUserActiveController(req: Request, res: Response<ResponseApiType>) {
    try {
        const { id } = req.params;

        if (Number(id) === req.user?.id) {
            return res.status(400).json({
                success: false,
                message: "Tidak bisa menonaktifkan atau mengaktifkan akun sendiri."
            });
        }

        const targetUser = await getUserByIdService(Number(id));
        if (targetUser?.email === 'pengurussurauzamzam@gmail.com') {
            return res.status(403).json({
                success: false,
                message: "Status aktif akun utama (pengurussurauzamzam@gmail.com) tidak dapat dinonaktifkan."
            });
        }


        const { user, action } = await userActiveService(Number(id));

        const message = action === "activate"
            ? `Berhasil mengaktifkan user: ${user.nama}. Email verifikasi telah dikirim ulang.`
            : `Berhasil menonaktifkan user: ${user.nama}. Status verifikasi ikut dinonaktifkan.`;

        return res.status(200).json({
            success: true,
            message,
            data: user
        });
    } catch (error) {
        return handlerAnyError(error, res);
    }
}

export async function deleteUserController(req: Request, res: Response<ResponseApiType>) {
    try {
        const { id } = req.params;
        
        // Memastikan user tidak bisa menghapus akunnya sendiri yang sedang login
        if (Number(id) === req.user?.id) {
            return res.status(400).json({
                success: false,
                message: "Tidak bisa menghapus akun sendiri."
            });
        }

        const targetUser = await getUserByIdService(Number(id));
        if (targetUser?.email === 'pengurussurauzamzam@gmail.com') {
            return res.status(403).json({
                success: false,
                message: "Akun utama (pengurussurauzamzam@gmail.com) tidak dapat dihapus."
            });
        }
        
        const { user: deletedUser, action } = await deleteUserService(Number(id));

        const message = action === 'delete' 
            ? `Berhasil menghapus user: ${deletedUser.nama}`
            : `Berhasil mengaktifkan kembali user: ${deletedUser.nama}. Verifikasi email telah dikirim.`;

        return res.status(200).json({
            success: true,
            message: message
        });
    } catch (error) {
        return handlerAnyError(error, res);
    }
}

export async function updatePhotoProfileController(req: Request, res: Response<ResponseApiType>) {
    try {
        const { id } = req.params;
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "File foto tidak ditemukan."
            });
        }

        const fotoProfileUrl = `/uploads/${req.file.filename}`;

        const updatedUser = await updatePhotoProfileService({ 
            id: Number(id), 
            fotoProfile: fotoProfileUrl 
        });
        
        return res.status(200).json({
            success: true,
            message: `Berhasil mengupdate foto profil user: ${updatedUser.nama}.`,
            data: updatedUser
        });
    } catch (error) {
        return handlerAnyError(error, res);
    }
}
