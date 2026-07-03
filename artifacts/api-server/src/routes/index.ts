import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entitiesRouter from "./entities";
import modelRouter from "./model";
import validationRouter from "./validation";
import driveRouter from "./drive";

const router: IRouter = Router();

router.use(healthRouter);
router.use(entitiesRouter);
router.use(modelRouter);
router.use(validationRouter);
router.use("/drive", driveRouter);

export default router;
