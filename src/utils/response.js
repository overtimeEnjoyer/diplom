/** Thin HTTP helpers — response shapes stay explicit per endpoint. */
export function sendJson(res, status, body) {
  return res.status(status).json(body);
}

export function sendData(res, data, status = 200) {
  return sendJson(res, status, { data });
}

export function sendCreated(res, data) {
  return sendData(res, data, 201);
}
