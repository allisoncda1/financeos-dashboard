import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entitiesRouter from "./entities";
import modelRouter from "./model";
import validationRouter from "./validation";
import driveRouter from "./drive";
import briefingRouter from "./briefing";
import rulesRouter from "./rules";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(entitiesRouter);
router.use(modelRouter);
router.use(validationRouter);
router.use("/drive", driveRouter);
router.use(briefingRouter);
router.use(rulesRouter);
router.use(reportsRouter);

export default router;
