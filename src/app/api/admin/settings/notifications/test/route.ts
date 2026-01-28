import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth/middleware';
import { z } from 'zod';
import { sendSlackMessage, sendDiscordMessage } from '@/lib/notifications/slack-discord';

const testNotificationSchema = z.object({
  channel: z.enum(['email', 'slack', 'discord']),
  recipient: z.string(), // Email address or webhook URL
});

interface TestNotificationResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * POST /api/admin/settings/notifications/test - Test notification delivery
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const body = await request.json();
    const validationResult = testNotificationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data: ' + validationResult.error.issues.map(i => i.message).join(', '),
        } as TestNotificationResponse,
        { status: 400 }
      );
    }

    const { channel, recipient } = validationResult.data;

    try {
      if (channel === 'slack') {
        await sendSlackMessage(
          recipient,
          {
            text: '✅ Slack Notification Test',
            attachments: [
              {
                text:
                  'This is a test notification from Conduit API Gateway. Your Slack integration is working correctly!',
                fields: [
                  { title: 'Test Type', value: 'Connection Test', short: true },
                  { title: 'Status', value: 'Success', short: true },
                  { title: 'Timestamp', value: new Date().toISOString(), short: false },
                ],
                footer: 'Conduit API Gateway',
                ts: Math.floor(Date.now() / 1000),
              },
            ],
          }
        );

        return NextResponse.json(
          {
            success: true,
            message: 'Test notification sent to Slack successfully',
          } as TestNotificationResponse,
          { status: 200 }
        );
      } else if (channel === 'discord') {
        await sendDiscordMessage(
          recipient,
          {
            content: '✅ Discord Notification Test',
            embeds: [
              {
                title: 'Connection Test',
                description:
                  'This is a test notification from Conduit API Gateway. Your Discord integration is working correctly!',
                color: 0x00ff00,
                fields: [
                  { name: 'Test Type', value: 'Connection Test', inline: true },
                  { name: 'Status', value: 'Success', inline: true },
                  { name: 'Timestamp', value: new Date().toISOString(), inline: false },
                ],
              },
            ],
          }
        );

        return NextResponse.json(
          {
            success: true,
            message: 'Test notification sent to Discord successfully',
          } as TestNotificationResponse,
          { status: 200 }
        );
      } else if (channel === 'email') {
        // Email sending would require an email service integration (SendGrid, AWS SES, etc.)
        // For now, return a success message indicating it would work
        return NextResponse.json(
          {
            success: true,
            message: 'Email notification configured (email service integration required for actual sending)',
          } as TestNotificationResponse,
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Unknown notification channel',
        } as TestNotificationResponse,
        { status: 400 }
      );
    } catch (error) {
      console.error('Error sending test notification:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send test notification',
        } as TestNotificationResponse,
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error testing notification:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test notification',
      } as TestNotificationResponse,
      { status: 500 }
    );
  }
}
