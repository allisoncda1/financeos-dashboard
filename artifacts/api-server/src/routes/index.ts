import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import entitiesRouter from "./entities";
import modelRouter from "./model";
import validationRouter from "./validation";
import driveRouter from "./drive";
import briefingRouter from "./briefing";
import rulesRouter from "./rules";
import reportsRouter from "./reports";
import aiRouter from "./ai";
import pipelineRouter from "./pipeline";
import { requireAuth } from "../auth/middleware";

const router: IRouter = Router();

// Public: no session required.
router.use(healthRouter);
router.use("/auth", authRouter);

// Pipeline webhook has its own auth (shared token, for the external pipeline
// job) layered with an in-route permission check for authenticated
// dashboard users — it must stay outside the blanket requireAuth gate below.
router.use("/pipeline", pipelineRouter);

// Everything below requires an authenticated session.
router.use(requireAuth);

router.use(entitiesRouter);
router.use(modelRouter);
router.use(validationRouter);
router.use("/drive", driveRouter);
router.use(briefingRouter);
router.use(rulesRouter);
router.use(reportsRouter);
router.use("/ai", aiRouter);

export default router;
