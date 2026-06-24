import { asyncHandler } from '../utils/asyncHandler.js';
import * as driverService from '../services/driver.service.js';
import { ApiError } from '../utils/ApiError.js';

export const listRecommended = asyncHandler(async (req, res) => {
  const lat = req.query.lat ? Number(req.query.lat) : undefined;
  const lng = req.query.lng ? Number(req.query.lng) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const drivers = await driverService.getRecommendedDrivers({ lat, lng, limit });
  res.json({ success: true, data: drivers });
});

export const getDriver = asyncHandler(async (req, res) => {
  const driver = await driverService.getDriverById(req.params.id);
  if (!driver) throw ApiError.notFound('Driver not found');
  res.json({ success: true, data: driver });
});
