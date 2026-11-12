import { Resend } from 'resend';
import 'dotenv/config';

const resend = new Resend(process.env.RESEND_API_KEY);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

export const sendTripNotification = async ({ to, type, tripId, inviterName }) => {
    let subject = '';
    let html = '';
    const tripUrl = `${CLIENT_URL}/trip/${tripId}`;

    switch (type) {
        case 'AUTO_ADDED':
            subject = `✈️ ${inviterName} added you to a trip!`;
            html = `<h2>Pack your bags!</h2><p>${inviterName} just added you to their itinerary on GoLocal.</p><a href="${tripUrl}" style="padding:10px 20px; background:#4f46e5; color:#fff; text-decoration:none; border-radius:5px;">View Trip</a>`;
            break;
        case 'REQUIRES_APPROVAL':
            subject = `📩 ${inviterName} invited you to a trip!`;
            html = `<h2>You have a trip invite!</h2><p>${inviterName} invited you. Because your privacy settings require approval, please log in to accept or decline.</p><a href="${tripUrl}" style="padding:10px 20px; background:#4f46e5; color:#fff; text-decoration:none; border-radius:5px;">Respond to Invite</a>`;
            break;
        case 'NEW_USER_INVITE':
            subject = `🌍 ${inviterName} is planning a trip and needs you!`;
            html = `<h2>Join GoLocal to see your trip</h2><p>${inviterName} is using GoLocal to plan a trip. Sign up with this email to automatically see your itinerary!</p><a href="${tripUrl}" style="padding:10px 20px; background:#4f46e5; color:#fff; text-decoration:none; border-radius:5px;">Join GoLocal</a>`;
            break;
        default:
            return;
    }

    return await resend.emails.send({
        from: 'GoLocal <invite@tejashreedumasia.me>',
        to,
        subject,
        html
    });
};