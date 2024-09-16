import { type Request, type Response, type NextFunction } from "express";
import * as logService from "$/service/jenkinsLogService";
import { log } from "$/utils/logger";
import { GetBuildStatusInput, type GetBuildLogInput, type StreamBuildLogInput } from "$/schema";
import { customJenkinsClient } from "$/utils/jenkinsClient";
import { createSuccessResponse } from "$/utils/apiResponse";

export const getBuildLogHandler = async (
  req: Request<GetBuildLogInput["params"], object, object, GetBuildLogInput["query"]>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { jobName, buildNumber } = req.params;
    const { start, type, meta } = req.query;

    const logOptions: logService.LogOptions = {
      name: jobName,
      number: parseInt(buildNumber, 10),
      start: start ? parseInt(start, 10) : undefined,
      type: type as "text" | "html" | undefined,
      meta: meta === "true",
    };

    const logData = await logService.getBuildLog(logOptions);
    console.log(logData);
    res.json(logData);
  } catch (error) {
    log.error(error);
    next(error);
  }
};

export const streamBuildLogHandler = async (
  req: Request<StreamBuildLogInput["params"], object, object, StreamBuildLogInput["query"]>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { jobName, buildNumber } = req.params;
    const { type, delay } = req.query;

    const streamOptions: logService.StreamOptions = {
      name: jobName,
      number: parseInt(buildNumber, 10),
      type: type as "text" | "html" | undefined,
      delay: delay ? parseInt(delay, 10) : undefined,
    };

    const logStream = await logService.getBuildLogStream(streamOptions); // Await the stream

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");

    logStream.on("data", (chunk) => {
      res.write(chunk);
    });

    logStream.on("end", () => {
      res.end();
    });

    logStream.on("error", (error) => {
      log.error(error);
      res.status(500).end("Error occurred while streaming log");
    });
  } catch (error) {
    log.error(error);
    next(error);
  }
};

export const getBuildStageHandler = async (
  req: Request<GetBuildStatusInput["params"]>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { jobName, buildNumber } = req.params;

    const pipelineRunDetails = await customJenkinsClient.getPipelineRunDetails(
      jobName,
      buildNumber
    );
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Transfer-Encoding", "chunked");

    // Stream the pipeline run details
    res.write(JSON.stringify(pipelineRunDetails));
    res.end();
  } catch (error) {
    console.error("Failed to fetch pipeline run details:", error);
    res.status(500).end("Error occurred while fetching pipeline run details");
    next(error);
  }
};
