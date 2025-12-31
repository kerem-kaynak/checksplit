import type {
  Check,
  CheckCreate,
  CheckUpdate,
  ClaimRequest,
  CheckSummary,
  OCRResponse,
} from "@/types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new ApiError(response.status, error.detail || "Request failed");
  }
  return response.json();
}

export async function createCheck(data: CheckCreate): Promise<Check> {
  const response = await fetch(`${API_URL}/api/checks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Check>(response);
}

export async function getCheck(code: string): Promise<Check> {
  const response = await fetch(`${API_URL}/api/checks/${code.toUpperCase()}`);
  return handleResponse<Check>(response);
}

export async function updateCheck(code: string, data: CheckUpdate): Promise<Check> {
  const response = await fetch(`${API_URL}/api/checks/${code.toUpperCase()}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Check>(response);
}

export async function claimSubItem(code: string, data: ClaimRequest): Promise<Check> {
  const response = await fetch(`${API_URL}/api/checks/${code.toUpperCase()}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Check>(response);
}

export async function getCheckSummary(code: string): Promise<CheckSummary> {
  const response = await fetch(`${API_URL}/api/checks/${code.toUpperCase()}/summary`);
  return handleResponse<CheckSummary>(response);
}

export async function processReceipt(file: File): Promise<OCRResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/checks/ocr`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<OCRResponse>(response);
}

export { ApiError };
