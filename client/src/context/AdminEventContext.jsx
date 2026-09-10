import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/http.js";

const STORAGE_KEY = "carnavales.admin.activeEventId";
const AdminEventContext = createContext(null);

function readStoredEventId() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeEventId(eventId) {
  try {
    if (eventId) window.localStorage.setItem(STORAGE_KEY, eventId);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage is an optional convenience, not a requirement for the session.
  }
}

export function AdminEventProvider({ children }) {
  const [events, setEvents] = useState([]);
  const [activeEventId, setActiveEventIdState] = useState(readStoredEventId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshEvents = async () => {
    setLoading(true);
    try {
      const items = await apiRequest("/api/v1/events");
      setEvents(items ?? []);
      setError("");
      setActiveEventIdState((current) => {
        const storedEvent = (items ?? []).find((event) => event.id === current);
        const nextId = storedEvent?.id ?? (items ?? [])[0]?.id ?? "";
        storeEventId(nextId);
        return nextId;
      });
      return items ?? [];
    } catch {
      setEvents([]);
      setError("No se pudieron cargar los eventos.");
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshEvents();
  }, []);

  const setActiveEventId = (eventId) => {
    const exists = events.some((event) => event.id === eventId);
    const nextId = exists ? eventId : "";
    setActiveEventIdState(nextId);
    storeEventId(nextId);
  };

  const setActiveEvent = (event) => {
    if (event?.id) {
      setEvents((current) => current.some((entry) => entry.id === event.id)
        ? current.map((entry) => entry.id === event.id ? { ...entry, ...event } : entry)
        : [...current, event]);
    }
    setActiveEventIdState(event?.id ?? "");
    storeEventId(event?.id ?? "");
  };

  const updateEvent = (event) => {
    if (!event?.id) return;
    setEvents((current) => current.map((entry) => entry.id === event.id ? { ...entry, ...event } : entry));
  };

  const activeEvent = events.find((event) => event.id === activeEventId) ?? null;
  const value = useMemo(() => ({
    events,
    activeEvent,
    activeEventId,
    loading,
    error,
    refreshEvents,
    setActiveEvent,
    setActiveEventId,
    updateEvent,
  }), [events, activeEvent, activeEventId, loading, error]);

  return <AdminEventContext.Provider value={value}>{children}</AdminEventContext.Provider>;
}

export function useAdminEvent() {
  return useContext(AdminEventContext);
}
