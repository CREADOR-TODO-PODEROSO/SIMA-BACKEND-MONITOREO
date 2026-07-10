const { Queue } = require('bullmq');
const env = require('./env');

const connection = {
  url: env.REDIS_URL,
};

// Cola de tareas para análisis predictivo (Épica 8)
const analyticsQueue = new Queue('analytics-jobs', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60000, // Reintento inicial en 1 minuto, luego 2, 4...
    },
    removeOnComplete: true,
    removeOnFail: false,
  }
});

module.exports = {
  connection,
  analyticsQueue
};
