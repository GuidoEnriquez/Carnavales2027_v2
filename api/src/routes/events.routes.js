import { Router } from "express";
import { auditEvent } from "../audit/audit-service.js";
import { requireAdmin } from "../auth/require-admin.js";
import { requireTwoFactor } from "../auth/two-factor.js";
import { getPool } from "../db/pool.js";
import { createEvent, createNight, getEvent, listEvents, listNights, updateEvent, updateNight } from "../modules/events/event-service.js";
import { createCategory, createTroupe, listCategories, updateCategory } from "../modules/troupes/category-service.js";
import { createSpecialty, listSpecialties, updateSpecialty } from "../modules/specialties/specialty-service.js";
import { createItem, createRubric, getRubric, listRubrics } from "../modules/rubrics/rubric-service.js";
import { getReadiness, openEvent } from "../modules/events/event-readiness.service.js";

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
      if (error.message === "EVENT_LOCKED") {
        response.status(409).json({ code: "EVENT_LOCKED" });
        return;
      }
      if (error.message === "SPECIALTY_INACTIVE") {
        response.status(409).json({ code: "SPECIALTY_INACTIVE" });
        return;
      }
      if (error instanceof TypeError) {
        response.status(400).json({ code: "VALIDATION_ERROR" });
        return;
      }
      next(error);
    } finally {
      client.release();
    }
  };
}

export function createEventsRouter({ requireSession }) {
  const router = Router();
  router.use(requireSession, requireTwoFactor, requireAdmin);
  router.get("/events", async (_request, response, next) => {
    try { response.json(await listEvents()); } catch (error) { next(error); }
  });
  router.get("/events/:eventId/readiness", async (request,response,next)=>{try{return response.json(await getReadiness({eventId:request.params.eventId}));}catch(error){if(error.message==='EVENT_NOT_FOUND')return response.status(404).json({code:error.message});return next(error);}});
  router.post("/events/:eventId/open", async (request,response,next)=>{try{const event=await openEvent({eventId:request.params.eventId,actorUserId:request.user.id});return response.json(event);}catch(error){if(error.message==='EVENT_CONFIGURATION_INCOMPLETE')return response.status(409).json({error:{code:error.message,details:error.readiness}});if(error.message==='EVENT_LOCKED')return response.status(409).json({code:error.message});if(error.message==='EVENT_NOT_FOUND')return response.status(404).json({code:error.message});return next(error);}});
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
  router.post("/events/:eventId/troupes", createWriteHandler("TROUPE_CREATED", "event_troupe", (client, request) => createTroupe({ client, eventId: request.params.eventId, ...request.body })));
  router.get("/events/:eventId/specialties", async (request, response, next) => { try { return response.json(await listSpecialties({ eventId: request.params.eventId })); } catch (error) { return next(error); } });
  router.post("/events/:eventId/specialties", createWriteHandler("SPECIALTY_CREATED", "event_specialty", (client, request) => createSpecialty({ client, eventId: request.params.eventId, ...request.body })));
  router.patch("/specialties/:specialtyId", createWriteHandler("SPECIALTY_UPDATED", "event_specialty", (client, request) => updateSpecialty({ client, specialtyId: request.params.specialtyId, ...request.body })));
  router.get("/events/:eventId/rubrics", async (request,response,next)=>{try{return response.json(await listRubrics({eventId:request.params.eventId}));}catch(error){return next(error);}});
  router.get("/rubrics/:rubricId", async (request,response,next)=>{try{const rubric=await getRubric({rubricId:request.params.rubricId});if(!rubric)return response.status(404).json({code:'RUBRIC_NOT_FOUND'});return response.json(rubric);}catch(error){return next(error);}});
  router.post("/events/:eventId/rubrics", createWriteHandler("RUBRIC_CREATED", "rubric", (client,request)=>createRubric({client,eventId:request.params.eventId,...request.body})));
  router.post("/rubrics/:rubricId/items", createWriteHandler("EVALUATION_ITEM_CREATED", "evaluation_item", (client,request)=>createItem({client,rubricId:request.params.rubricId,...request.body})));
  return router;
}
