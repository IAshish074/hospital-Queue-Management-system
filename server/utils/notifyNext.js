async function notifyNextInQueue(queue) {
  try {
    const nextQueue = await Queue.findOne({
      doctorId: queue.doctorId,
      status: 'Booked',
    }).sort({ estimatedStartTime: 1 });

    if (nextQueue) {
      const nextPatient = await Queue.findById(nextQueue._id);

      if (nextPatient) {
        const message = `Your turn is up! Please visit Dr. ${nextPatient.doctorId} at your scheduled time: ${nextPatient.estimatedStartTime.toLocaleTimeString()}`;
        await sendEmail(nextPatient.phoneNumber, message);
        console.log('Next person notified!');
      }
    }
  } catch (error) {
    console.error('Error notifying next in queue:', error);
  }
}

module.exports =  notifyNextInQueue ;
