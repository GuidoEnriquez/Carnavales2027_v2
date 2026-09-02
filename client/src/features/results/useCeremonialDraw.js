import { useCallback, useState } from "react";
import { apiRequest } from "../../api/http.js";

export function useCeremonialDraw() {
  const [draw, setDraw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async ({ eventId, remainingTroupeIds }) => {
    setLoading(true);
    setError(null);
    setDraw(null);
    try {
      const result = await apiRequest(
        `/api/v1/events/${eventId}/tie-breaker/ceremonial-draw`,
        {
          method: "POST",
           body: JSON.stringify({ remainingTroupeIds }),
        },
      );
      setDraw(result);
      return result;
    } catch (nextError) {
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, []);

  return { draw, loading, error, execute };
}
