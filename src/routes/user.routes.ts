import { Router } from "express";
import { getAlluserController, createUserController, getUserByIdController, updateUserController, deleteUserController, updatePhotoProfileController, toggleUserActiveController } from "../controllers/user.controller";
import { createUserValidator, updateUserValidator, idValidator, updatePhotoValidator } from "../validator/user.validator";
import upload, { validateUploadSizeByType } from "../middlewares/upload";
import { jwtCheckToken } from "../middlewares/jwt_check_token";
import { isRole } from "../middlewares/is_role";
import { meController } from "../controllers/auth.controller";
const router = Router();

router.get("/me", jwtCheckToken, meController);
router.get("/", jwtCheckToken, isRole("superadmin"), getAlluserController);
router.get("/:id", jwtCheckToken, isRole("superadmin"), idValidator, getUserByIdController);
router.post("/", upload.none(), createUserValidator, createUserController);
router.put("/:id", jwtCheckToken, isRole("superadmin"), upload.none(), updateUserValidator, updateUserController);
router.patch("/:id/activate", jwtCheckToken, isRole("superadmin"), idValidator, toggleUserActiveController);
router.delete("/:id", jwtCheckToken, isRole("superadmin"), idValidator, deleteUserController);
router.patch("/:id/photo", jwtCheckToken, isRole("superadmin", "admin"), updatePhotoValidator, upload.single("fotoProfile"), validateUploadSizeByType, updatePhotoProfileController);

export default router;