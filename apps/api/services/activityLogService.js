const activityRepo = require("../repositories/activityLogRepository");

exports.log = async (payload) => {
    try {
        await activityRepo.create(payload);
    } catch (error) {
        // Logging failures should not break API requests.
        console.error("activity-log-error:", error.message);
    }
};
