const Order = require('../models/order');
const Customer = require('../models/customer');
const Notification = require('../models/notification');
const JobRun = require('../models/jobRun');

const JOB_KEY = 'recurring_orders';
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

const getTriggerDate = (order) => {
  const baseDate = order.deliveredAt || order.deliveryDate || order.createdAt;
  const intervalDays = order.recurringIntervalDays || 30;
  return new Date(new Date(baseDate).getTime() + intervalDays * 24 * 60 * 60 * 1000);
};

const claimOrder = (orderId, now) => Order.findOneAndUpdate({
  _id: orderId,
  isRecurring: true,
  status: 'Delivered',
  recurringProcessed: false,
  $or: [
    { recurringProcessingAt: null },
    { recurringProcessingAt: { $lt: new Date(now.getTime() - CLAIM_TIMEOUT_MS) } },
  ],
}, { $set: { recurringProcessingAt: now } }, { new: true });

const completeClaim = (orderId) => Order.updateOne(
  { _id: orderId },
  { $set: { recurringProcessed: true, recurringProcessingAt: null } },
);

const releaseClaim = (orderId) => Order.updateOne(
  { _id: orderId, recurringProcessed: false },
  { $set: { recurringProcessingAt: null } },
);

const createRecurringSuccessor = async (sourceOrder, now, triggeredBy) => {
  const existing = await Order.findOne({ recurringSourceOrder: sourceOrder._id });
  if (existing) {
    await completeClaim(sourceOrder._id);
    return { created: false, order: existing };
  }

  try {
    const successor = await Order.create({
      customer: sourceOrder.customer,
      items: sourceOrder.items,
      totalAmount: sourceOrder.totalAmount,
      deliveryDate: now,
      status: 'Pending',
      branch: sourceOrder.branch,
      isRecurring: true,
      isGstApplicable: sourceOrder.isGstApplicable,
      recurringIntervalDays: sourceOrder.recurringIntervalDays,
      recurringSourceOrder: sourceOrder._id,
      statusHistory: [{ status: 'Pending', updatedBy: triggeredBy }],
    });

    await completeClaim(sourceOrder._id);

    const customer = await Customer.findById(sourceOrder.customer).select('name');
    await Notification.findOneAndUpdate({
      type: 'delivery_reminder',
      relatedId: successor._id,
    }, {
      $setOnInsert: {
        title: 'Recurring Order Created',
        message: `A recurring order was created by the owner${customer ? ` for ${customer.name}` : ''}.`,
        type: 'delivery_reminder',
        relatedId: successor._id,
      },
    }, { upsert: true, new: true, setDefaultsOnInsert: true });

    return { created: true, order: successor };
  } catch (err) {
    await releaseClaim(sourceOrder._id);
    throw err;
  }
};

const processCandidates = async ({ orderId, force = false, triggeredBy, now = new Date() }) => {
  const filter = {
    isRecurring: true,
    status: 'Delivered',
    recurringProcessed: false,
  };
  if (orderId) filter._id = orderId;

  const candidates = await Order.find(filter);
  const result = { scanned: candidates.length, due: 0, created: 0, skipped: 0 };
  const createdOrders = [];

  for (const candidate of candidates) {
    if (!force && now < getTriggerDate(candidate)) {
      result.skipped += 1;
      continue;
    }
    result.due += 1;

    const claimed = await claimOrder(candidate._id, now);
    if (!claimed) {
      result.skipped += 1;
      continue;
    }

    const outcome = await createRecurringSuccessor(claimed, now, triggeredBy);
    if (outcome.created) {
      result.created += 1;
      createdOrders.push(outcome.order);
    } else {
      result.skipped += 1;
    }
  }

  return { result, createdOrders };
};

const runRecurringOrders = async ({ orderId, force = false, triggeredBy }) => {
  const startedAt = new Date();
  await JobRun.findOneAndUpdate({ jobKey: JOB_KEY }, {
    $set: {
      status: 'running',
      trigger: 'owner',
      triggeredBy,
      lastStartedAt: startedAt,
      lastCompletedAt: null,
      lastError: '',
    },
  }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });

  try {
    const output = await processCandidates({ orderId, force, triggeredBy, now: startedAt });
    const completedAt = new Date();
    await JobRun.updateOne({ jobKey: JOB_KEY }, {
      $set: {
        status: 'succeeded',
        lastCompletedAt: completedAt,
        lastSuccessfulRunAt: completedAt,
        lastResult: output.result,
        lastError: '',
      },
    }, { runValidators: true });
    return output;
  } catch (err) {
    await JobRun.updateOne({ jobKey: JOB_KEY }, {
      $set: {
        status: 'failed',
        lastCompletedAt: new Date(),
        lastError: err?.name || 'JobError',
      },
    }, { runValidators: true });
    throw err;
  }
};

const getRecurringJobStatus = () => JobRun.findOne({ jobKey: JOB_KEY })
  .select('status trigger lastStartedAt lastCompletedAt lastSuccessfulRunAt lastResult')
  .lean();

module.exports = { getTriggerDate, processCandidates, runRecurringOrders, getRecurringJobStatus };
