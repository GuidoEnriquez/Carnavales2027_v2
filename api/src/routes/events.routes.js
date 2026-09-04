import { Router } from "express";
import { auditEvent } from "../audit/audit-service.js";
import { requireAdmin } from "../auth/require-admin.js";
import { requireTwoFactor } from "../auth/two-factor.js";
import { getPool } from "../db/pool.js";
import { createEvent, createNight, getEvent, listEvents, listNights, updateEvent, updateNight } from "../modules/events/event-service.js";
import {
  createCategory,
  createTroupe,
  listCategories,
  listTroupes,
  updateCategory,
  updateTroupe,
} from "../modules/troupes/category-service.js";
import { createSpecialty, listSpecialties, updateSpecialty } from "../modules/specialties/specialty-service.js";
import {
  createCriterion,
  createItem,
  createRubric,
  getRubric,
  listRubrics,
  updateCriterion,
  updateItem,
  updateRubric,
} from "../modules/rubrics/rubric-service.js";
import { getReadiness, openEvent } from "../modules/events/event-readiness.service.js";
import { sendKnownError } from "./http-errors.js";

function createWriteHandler(action, entityType, operation) {
  return async (request, response, next) => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await operation(client, request);
      await auditEvent(client, {
        actorUserId: request.user.id,
        action,
        entityType,
        entityId: result.id,
        after: result,
      });
      await client.query("COMMIT");
      response.status(action.endsWith("CREATED") ? 201 : 200).json(result);
    } catch (error) {
      await client.query("ROLLBACK");
      if (sendKnownError(response, error)) return;
      next(error);
    } finally {
      client.release();
    }
  };
}

export function createEventsRouter({ requireSession }) {
  const router = Router();
  const admin = [requireSession, requireTwoFactor, requireAdmin];
  for (const prefix of [
    "/events",
    "/rubrics",
    "/nights",
    "/categories",
    "/troupes",
    "/specialties",
    "/evaluation-items",
    "/rubric-criteria",
  ]) {
    router.use(prefix, ...admin);
  }
  router.get("/events", async (_request, response, next) => {
    try { response.json(await listEvents()); } catch (error) { next(error); }
  });
  router.get("/events/:eventId/readiness", async (request,response,next)=>{try{return response.json(await getReadiness({eventId:request.params.eventId}));}catch(error){if(error.message==='EVENT_NOT_FOUND')return response.status(404).json({code:error.message});return next(error);}});
  router.post("/events/:eventId/open", async (request,response,next)=>{try{const event=await openEvent({eventId:request.params.eventId,actorUserId:request.user.id});return response.json(event);}catch(error){if(error.message==='EVENT_CONFIGURATION_INCOMPLETE')return response.status(409).json({code:error.message,details:error.readiness});if(error.message==='EVENT_LOCKED')return response.status(409).json({code:error.message});if(error.message==='EVENT_NOT_FOUND')return response.status(404).json({code:error.message});return next(error);}});
  router.get("/events/:eventId", async (request, response, next) => {
    try {
      const event = await getEvent({ eventId: request.params.eventId });
      if (!event) return response.status(404).json({ code: "EVENT_NOT_FOUND" });
      return response.json(event);
    } catch (error) { return next(error); }
  });
  router.get("/events/:eventId/nights", async (request, response, next) => {
    try { return response.json(await listNights({ eventId: request.params.eventId })); } catch (error) { return next(error); }
  });
  router.post("/events", createWriteHandler("EVENT_CREATED", "carnival_event", (client, request) => createEvent({ client, ...request.body })));
  router.patch("/events/:eventId", createWriteHandler("EVENT_UPDATED", "carnival_event", (client, request) => updateEvent({ client, eventId: request.params.eventId, ...request.body })));
  router.post("/events/:eventId/nights", createWriteHandler("NIGHT_CREATED", "night", (client, request) => createNight({ client, eventId: request.params.eventId, ...request.body })));
  router.patch("/nights/:nightId", createWriteHandler("NIGHT_UPDATED", "night", (client, request) => updateNight({ client, nightId: request.params.nightId, ...request.body })));
  router.get("/events/:eventId/categories", async (request, response, next) => {
    try { return response.json(await listCategories({ eventId: request.params.eventId, eligible: request.query.eligible === "true" })); } catch (error) { return next(error); }
  });
  router.post("/events/:eventId/categories", createWriteHandler("CATEGORY_CREATED", "event_category", (client, request) => createCategory({ client, eventId: request.params.eventId, ...request.body })));
  router.patch("/categories/:categoryId", createWriteHandler("CATEGORY_UPDATED", "event_category", (client, request) => updateCategory({ client, categoryId: request.params.categoryId, ...request.body })));
  router.get("/events/:eventId/troupes", async (request, response, next) => { try { return response.json(await listTroupes({ eventId: request.params.eventId })); } catch (error) { return next(error); } });
  router.post("/events/:eventId/troupes", createWriteHandler("TROUPE_CREATED", "event_troupe", (client, request) => createTroupe({ client, eventId: request.params.eventId, ...request.body })));
  router.patch("/troupes/:troupeId", createWriteHandler("TROUPE_UPDATED", "event_troupe", (client, request) => updateTroupe({ client, troupeId: request.params.troupeId, ...request.body })));
  router.get("/events/:eventId/specialties", async (request, response, next) => { try { return response.json(await listSpecialties({ eventId: request.params.eventId })); } catch (error) { return next(error); } });
  router.post("/events/:eventId/specialties", createWriteHandler("SPECIALTY_CREATED", "event_specialty", (client, request) => createSpecialty({ client, eventId: request.params.eventId, ...request.body })));
  router.patch("/specialties/:specialtyId", createWriteHandler("SPECIALTY_UPDATED", "event_specialty", (client, request) => updateSpecialty({ client, specialtyId: request.params.specialtyId, ...request.body })));
  router.get("/events/:eventId/rubrics", async (request,response,next)=>{try{return response.json(await listRubrics({eventId:request.params.eventId}));}catch(error){return next(error);}});
  router.get("/rubrics/:rubricId", async (request,response,next)=>{try{const rubric=await getRubric({rubricId:request.params.rubricId});if(!rubric)return response.status(404).json({code:'RUBRIC_NOT_FOUND'});return response.json(rubric);}catch(error){return next(error);}});
  router.post("/events/:eventId/rubrics", createWriteHandler("RUBRIC_CREATED", "rubric", (client,request)=>createRubric({client,eventId:request.params.eventId,...request.body})));
  router.patch("/rubrics/:rubricId", createWriteHandler("RUBRIC_UPDATED", "rubric", (client,request)=>updateRubric({client,rubricId:request.params.rubricId,...request.body})));
  router.get("/rubrics/:rubricId/items", async (request,response,next)=>{try{const rubric=await getRubric({rubricId:request.params.rubricId});if(!rubric)return response.status(404).json({code:'RUBRIC_NOT_FOUND'});return response.json(rubric.items);}catch(error){return next(error);}});
  router.post("/rubrics/:rubricId/items", createWriteHandler("EVALUATION_ITEM_CREATED", "evaluation_item", (client,request)=>createItem({client,rubricId:request.params.rubricId,...request.body})));
  router.patch("/evaluation-items/:itemId", createWriteHandler("EVALUATION_ITEM_UPDATED", "evaluation_item", (client,request)=>updateItem({client,itemId:request.params.itemId,...request.body})));
  router.get("/rubrics/:rubricId/criteria", async (request,response,next)=>{try{const rubric=await getRubric({rubricId:request.params.rubricId});if(!rubric)return response.status(404).json({code:'RUBRIC_NOT_FOUND'});return response.json(rubric.criteria);}catch(error){return next(error);}});
  router.post("/rubrics/:rubricId/criteria", createWriteHandler("RUBRIC_CRITERION_CREATED", "rubric_criterion", (client,request)=>createCriterion({client,rubricId:request.params.rubricId,...request.body})));
  router.patch("/rubric-criteria/:criterionId", createWriteHandler("RUBRIC_CRITERION_UPDATED", "rubric_criterion", (client,request)=>updateCriterion({client,criterionId:request.params.criterionId,...request.body})));
  return router;
}
