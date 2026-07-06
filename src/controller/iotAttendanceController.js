const IoTAttendanceService = require('../services/IoTAttendanceService');

const receiveAttendanceAttempt = async (req, res) => {
  const result = await IoTAttendanceService.receiveAttendanceAttempt(req.body);
  return res.status(result.status).json({
    ok: result.status >= 200 && result.status < 300,
    ...result.body,
  });
};

module.exports = {
  receiveAttendanceAttempt,
};
