const express = require('express');
const { getCheckoutQueue } = require('../workers/checkoutWorker');

const router = express.Router();

/**
 * GET /api/queue-status/:jobId
 * Poll job status from the Bull queue.
 * Returns current state + position/result depending on status.
 */
router.get('/queue-status/:jobId', async (req, res) => {
  try {
    const queue = getCheckoutQueue();
    const job = await queue.getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'not_found', message: 'Job not found' });
    }

    const state = await job.getState();

    switch (state) {
      case 'waiting': {
        // Calculate position in queue
        const waiting = await queue.getWaiting();
        const position = waiting.findIndex(j => j.id === job.id) + 1;
        return res.json({
          status: 'waiting',
          position,
          estimatedWait: position * 50, // ~50ms per job
        });
      }

      case 'active':
        return res.json({
          status: 'active',
          startedAt: job.processedOn,
        });

      case 'completed':
        return res.json({
          status: 'completed',
          ...job.returnvalue,
        });

      case 'failed':
        return res.json({
          status: 'failed',
          reason: job.failedReason || 'Unknown error',
        });

      case 'delayed':
        return res.json({
          status: 'delayed',
          delay: job.opts.delay,
        });

      default:
        return res.json({ status: state });
    }
  } catch (err) {
    console.error('[Queue] Error checking job status:', err.message);
    res.status(500).json({ error: 'server_error', message: 'Failed to check job status' });
  }
});

module.exports = router;
