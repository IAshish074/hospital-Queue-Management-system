// utils/scheduler.js
const Queue = require('../models/Queue');
const notifyNextInQueue = require('./notifyNext');

const updateStatus = async () => {
    try {
        const now = new Date();
        const timeOutMinutes = 5; // Time limit in minutes after estimated start time to set to 'Pending'

        // Find bookings whose estimated start time has passed and are still 'Booked'
        const overdueBookings = await Queue.find({
            status: 'Booked',
            estimatedStartTime: { $lte: new Date(now.getTime() - timeOutMinutes * 60000) },
        });

        for (const booking of overdueBookings) {
            // Check if admin has already taken any action on this booking
            const existingUpdate = await Queue.findOne({
                _id: booking._id,
                status: { $in: ['Served', 'Cancelled', 'Pending', 'Skipped'] }
            });

            // If no admin action found, set the status to 'Pending'
            if (!existingUpdate) {
                booking.status = 'Pending';
                await booking.save();
                console.log(`[${new Date().toLocaleTimeString()}] Queue ${booking.tokenNumber} updated to Pending.`);
            }
        }

        // Update 'Skipped' and 'Cancelled' statuses based on time (consider if admin action should override)
        const statusConfigs = [
            { status: 'Skipped', offsetMinutes: 10 },
            { status: 'Cancelled', offsetMinutes: 15 },
        ];

        for (const config of statusConfigs) {
            const expiredQueues = await Queue.find({
                status: 'Booked',
                estimatedStartTime: {
                    $lte: new Date(now.getTime() - config.offsetMinutes * 60000)
                },
            });

            for (const queue of expiredQueues) {
                const existingAdminAction = await Queue.findOne({
                    _id: queue._id,
                    status: { $in: ['Served', 'Cancelled', 'Pending', 'Skipped'] }
                });

                if (!existingAdminAction) {
                    queue.status = config.status;
                    await queue.save();
                }
            }
        }

        // Notify upcoming queues
        const notifyStart = new Date(now.getTime() + 10 * 60000);
        const notifyEnd = new Date(now.getTime() + 15 * 60000);

        const upcomingQueues = await Queue.find({
            status: 'Booked',
            estimatedStartTime: { $gte: notifyStart, $lte: notifyEnd },
        });

        for (const queue of upcomingQueues) {
            await notifyNextInQueue(queue);
        }

        console.log(`[${new Date().toLocaleTimeString()}] Queue auto-updated.`);
    } catch (error) {
        console.error('Auto-status update error:', error);
    }
};

module.exports = updateStatus;