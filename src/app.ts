import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import apiRouter from "./routes/index.routes"
import morgan from "morgan"
import path from "path"
import upload from "./middlewares/upload"
import cookieParser from "cookie-parser"
if (process.env.NODE_ENV === 'production') {
    dotenv.config({ path: '.env.production' }); 
} else {
    dotenv.config({ path: '.env' }); 
}
const app = express()

app.use(express.urlencoded({ extended: true }));
app.use(express.json())
app.use(cookieParser())
app.use(morgan("dev"))
app.use(cors({
    origin: [process.env.FRONTEND_URL!, "http://localhost:3001"],
    credentials: true
}))
app.use(express.static(path.join(process.cwd(), 'public')));

app.use((req, res, next) => {
    if (req.method === 'GET' || req.is('multipart/form-data') || req.method === 'PUT' || req.originalUrl.includes('/photo')) {
        return next();
    }

    return upload.none()(req, res, next);
});

app.use("/api", apiRouter)

export default app