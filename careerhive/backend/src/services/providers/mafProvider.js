function createMafProvider() {
  const serviceUrl = process.env.MAF_SERVICE_URL;
  if (!serviceUrl) throw new Error("MAF_SERVICE_URL is missing.");

  return {
    name: "maf-sk",
    async analyze({ resume, job }) {
      const res = await fetch(`${serviceUrl}/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, job }),
        signal: AbortSignal.timeout(90_000)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`MAF service error ${res.status}: ${body.detail || res.statusText}`);
      }
      return res.json();
    }
  };
}

module.exports = { createMafProvider };
