import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.ts";

const app = new Hono();

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const OIL_DUE_TACH_KEY = "maintenance:oil_due_tach";
const DEFAULT_OIL_DUE_TACH = 643;

const ANNUAL_KEY = "maintenance:annual";
const DEFAULT_ANNUAL = { date: "2026-02-15", hobbs: 4539.0, tach: 590.4 };

type AnnualBaseline = { date: string; hobbs: number; tach: number };

async function getAnnualBaseline(): Promise<AnnualBaseline> {
  const stored = await kv.get(ANNUAL_KEY);
  if (
    stored &&
    typeof stored === "object" &&
    typeof (stored as { date?: unknown }).date === "string" &&
    typeof (stored as { hobbs?: unknown }).hobbs === "number" &&
    typeof (stored as { tach?: unknown }).tach === "number"
  ) {
    return stored as AnnualBaseline;
  }
  await kv.set(ANNUAL_KEY, DEFAULT_ANNUAL);
  return DEFAULT_ANNUAL;
}

async function getOilDueTach(): Promise<number> {
  const stored = await kv.get(OIL_DUE_TACH_KEY);
  if (typeof stored === "number") return stored;
  await kv.set(OIL_DUE_TACH_KEY, DEFAULT_OIL_DUE_TACH);
  return DEFAULT_OIL_DUE_TACH;
}

const PILOT_COLORS = ["#4E5166", "#7C90A0", "#B5AA9D", "#747274", "#B9B7A7"];

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-82b8c834/health", (c) => {
  return c.json({ status: "ok" });
});

// Initialize default users if not exists
app.post("/make-server-82b8c834/init-users", async (c) => {
  try {
    const existingUsers = await kv.getByPrefix("user:");
    
    if (existingUsers.length === 0) {
      const defaultUsers = [
        { id: "user1", name: "Pilot One", email: "pilot1@example.com", color: "#4E5166", phone: "" },
        { id: "user2", name: "Pilot Two", email: "pilot2@example.com", color: "#7C90A0", phone: "" },
        { id: "user3", name: "Pilot Three", email: "pilot3@example.com", color: "#B5AA9D", phone: "" }
      ];
      
      // Set each user individually
      for (const user of defaultUsers) {
        await kv.set(`user:${user.id}`, user);
      }
      
      return c.json({ success: true, users: defaultUsers });
    }
    
    // Migrate existing users to add phone field if missing
    let migrated = false;
    for (const user of existingUsers) {
      if (!user.hasOwnProperty('phone')) {
        user.phone = "";
        await kv.set(user.id, user);
        migrated = true;
      }
    }
    
    if (migrated) {
      const updatedUsers = await kv.getByPrefix("user:");
      return c.json({ success: true, users: updatedUsers, migrated: true });
    }
    
    return c.json({ success: true, users: existingUsers });
  } catch (error) {
    console.log("Error initializing users:", error);
    return c.json({ error: `Failed to initialize users: ${error}` }, 500);
  }
});

// Get all users
app.get("/make-server-82b8c834/users", async (c) => {
  try {
    const users = await kv.getByPrefix("user:");
    return c.json(users);
  } catch (error) {
    console.log("Error fetching users:", error);
    return c.json({ error: `Failed to fetch users: ${error}` }, 500);
  }
});

// Get all bookings
app.get("/make-server-82b8c834/bookings", async (c) => {
  try {
    const bookings = await kv.getByPrefix("booking:");
    return c.json(bookings);
  } catch (error) {
    console.log("Error fetching bookings:", error);
    return c.json({ error: `Failed to fetch bookings: ${error}` }, 500);
  }
});

// Create a new booking
app.post("/make-server-82b8c834/bookings", async (c) => {
  try {
    const booking = await c.req.json();
    const { userId, userName, startTime, endTime, title, notes, userColor, isRequest, requestedBy, requestedByName } = booking;
    
    console.log("Creating booking with data:", { userId, userName, startTime, endTime, title, notes, userColor, isRequest, requestedBy, requestedByName });
    
    // Validate required fields
    if (!userId || !startTime || !endTime) {
      return c.json({ error: "Missing required fields: userId, startTime, endTime" }, 400);
    }
    
    // Check for conflicts
    const existingBookings = await kv.getByPrefix("booking:");
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    console.log("Parsed dates:", { start, end });
    
    // Check for blocked days
    const dayNotes = await kv.getByPrefix("daynote:");
    for (const note of dayNotes) {
      if (note.blocksScheduling) {
        const noteDate = new Date(note.date);
        noteDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(noteDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        // Check if booking overlaps with blocked day
        if ((start < nextDay && end > noteDate)) {
          return c.json({ 
            error: `Cannot book on ${note.date}: ${note.note}` 
          }, 409);
        }
      }
    }
    
    // Check for booking conflicts
    // Notes don't block anything, maintenance blocks everything, requests don't block anything
    const isNewBookingNote = userId === 'note';
    const isNewBookingMaintenance = userId === 'maintenance';
    const isNewBookingRequest = isRequest === true;
    
    for (const b of existingBookings) {
      const bookingStart = new Date(b.startTime);
      const bookingEnd = new Date(b.endTime);
      
      // Check if times overlap
      if ((start < bookingEnd && end > bookingStart)) {
        const isExistingNote = b.userId === 'note';
        const isExistingMaintenance = b.userId === 'maintenance';
        const isExistingRequest = b.isRequest === true && !b.acceptedBy;
        
        // Skip conflict if both are notes
        if (isNewBookingNote && isExistingNote) {
          continue;
        }
        
        // Skip conflict if new is note and existing is not maintenance
        if (isNewBookingNote && !isExistingMaintenance) {
          continue;
        }
        
        // Skip conflict if existing is note and new is not maintenance
        if (isExistingNote && !isNewBookingMaintenance) {
          continue;
        }
        
        // Skip conflict if new booking is a request (requests don't block)
        if (isNewBookingRequest) {
          continue;
        }
        
        // Skip conflict if existing booking is an unaccepted request
        if (isExistingRequest) {
          continue;
        }
        
        // Otherwise, there's a conflict
        return c.json({ 
          error: `Booking conflict with ${b.userName}'s booking from ${bookingStart.toLocaleString()} to ${bookingEnd.toLocaleString()}` 
        }, 409);
      }
    }
    
    const bookingId = `booking:${Date.now()}_${userId}`;
    const newBooking = {
      id: bookingId,
      userId,
      userName,
      userColor,
      startTime,
      endTime,
      title: title || "Aircraft Reservation",
      notes: notes || "",
      createdAt: new Date().toISOString(),
      isRequest: isRequest || false,
      requestedBy: requestedBy || null,
      requestedByName: requestedByName || null,
      acceptedBy: null
    };
    
    await kv.set(bookingId, newBooking);
    
    // Send SMS notifications to pilots who have opted in
    try {
      await sendBookingNotifications(newBooking);
    } catch (smsError) {
      console.log("SMS notification error (non-fatal):", smsError);
      // Don't fail the booking creation if SMS fails
    }
    
    return c.json({ success: true, booking: newBooking });
  } catch (error) {
    console.log("Error creating booking:", error);
    return c.json({ error: `Failed to create booking: ${error}` }, 500);
  }
});

// Delete a booking
app.delete("/make-server-82b8c834/bookings/:id", async (c) => {
  try {
    const bookingId = c.req.param("id");
    
    // Get the booking before deleting it (for SMS notification)
    const booking = await kv.get(bookingId);
    
    if (!booking) {
      return c.json({ error: "Booking not found" }, 404);
    }
    
    // Delete the booking
    await kv.del(bookingId);
    
    // Send cancellation SMS notifications
    try {
      await sendCancellationNotifications(booking);
    } catch (smsError) {
      console.log("SMS cancellation notification error (non-fatal):", smsError);
      // Don't fail the deletion if SMS fails
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting booking:", error);
    return c.json({ error: `Failed to delete booking: ${error}` }, 500);
  }
});

// Update a booking
app.patch("/make-server-82b8c834/bookings/:id", async (c) => {
  try {
    const bookingId = c.req.param("id");
    const updates = await c.req.json();
    
    // Get existing booking
    const existingBooking = await kv.get(bookingId);
    
    if (!existingBooking) {
      return c.json({ error: "Booking not found" }, 404);
    }
    
    // Merge updates with existing booking
    const updatedBooking = {
      ...existingBooking,
      ...updates,
      id: bookingId // Ensure ID doesn't change
    };
    
    // Check for conflicts if start or end time is being updated
    if (updates.startTime || updates.endTime) {
      const allBookings = await kv.getByPrefix("booking:");
      const start = new Date(updatedBooking.startTime);
      const end = new Date(updatedBooking.endTime);
      
      // Check for blocked days
      const dayNotes = await kv.getByPrefix("daynote:");
      for (const note of dayNotes) {
        if (note.blocksScheduling) {
          const noteDate = new Date(note.date);
          noteDate.setHours(0, 0, 0, 0);
          const nextDay = new Date(noteDate);
          nextDay.setDate(nextDay.getDate() + 1);
          
          // Check if booking overlaps with blocked day
          if ((start < nextDay && end > noteDate)) {
            return c.json({ 
              error: `Cannot book on ${note.date}: ${note.note}` 
            }, 409);
          }
        }
      }
      
      // Check for booking conflicts
      // Notes don't block anything, but maintenance blocks everything
      const isNewBookingNote = updatedBooking.userId === 'note';
      const isNewBookingMaintenance = updatedBooking.userId === 'maintenance';
      
      for (const b of allBookings) {
        // Skip checking against itself
        if (b.id === bookingId) {
          continue;
        }
        
        const bookingStart = new Date(b.startTime);
        const bookingEnd = new Date(b.endTime);
        
        // Check if times overlap
        if ((start < bookingEnd && end > bookingStart)) {
          const isExistingNote = b.userId === 'note';
          const isExistingMaintenance = b.userId === 'maintenance';
          
          // Skip conflict if both are notes
          if (isNewBookingNote && isExistingNote) {
            continue;
          }
          
          // Skip conflict if new is note and existing is not maintenance
          if (isNewBookingNote && !isExistingMaintenance) {
            continue;
          }
          
          // Skip conflict if existing is note and new is not maintenance
          if (isExistingNote && !isNewBookingMaintenance) {
            continue;
          }
          
          // Otherwise, there's a conflict
          return c.json({ 
            error: `Booking conflict with ${b.userName}'s booking from ${bookingStart.toLocaleString()} to ${bookingEnd.toLocaleString()}` 
          }, 409);
        }
      }
    }
    
    // Save updated booking
    await kv.set(bookingId, updatedBooking);
    
    return c.json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.log("Error updating booking:", error);
    return c.json({ error: `Failed to update booking: ${error}` }, 500);
  }
});

// Update user
app.put("/make-server-82b8c834/users/:id", async (c) => {
  try {
    const userId = c.req.param("id");
    const updates = await c.req.json();
    
    console.log("Updating user:", userId, "with updates:", updates);
    
    // Get existing user - userId already includes 'user:' prefix
    const userKey = userId.startsWith('user:') ? userId : `user:${userId}`;
    const existingUser = await kv.get(userKey);
    
    console.log("Existing user:", existingUser);
    
    if (!existingUser) {
      console.log("User not found with key:", userKey);
      return c.json({ error: "User not found" }, 404);
    }
    
    // Merge updates with existing user data
    const updatedUser = {
      ...existingUser,
      ...updates,
      id: userKey // Ensure ID is consistent with key
    };
    
    console.log("Saving updated user:", updatedUser);
    await kv.set(userKey, updatedUser);
    
    return c.json({ success: true, user: updatedUser });
  } catch (error) {
    console.log("Error updating user:", error);
    return c.json({ error: `Failed to update user: ${error}` }, 500);
  }
});

// Add new user
app.post("/make-server-82b8c834/users", async (c) => {
  try {
    const userData = await c.req.json();
    const { name, email, phone, color } = userData;
    
    // Validate required fields
    if (!name || !email) {
      return c.json({ error: "Missing required fields: name, email" }, 400);
    }
    
    // Generate user ID
    const userId = `user:${Date.now()}`;
    
    const newUser = {
      id: userId,
      name,
      email,
      phone: phone || "",
      color: color || "#4E5166",
      createdAt: new Date().toISOString()
    };
    
    await kv.set(userId, newUser);
    
    return c.json({ success: true, user: newUser });
  } catch (error) {
    console.log("Error adding user:", error);
    return c.json({ error: `Failed to add user: ${error}` }, 500);
  }
});

// Delete user
app.delete("/make-server-82b8c834/users/:id", async (c) => {
  try {
    const userId = c.req.param("id");
    const userKey = `user:${userId}`;
    
    console.log("Deleting user with key:", userKey);
    
    // Check if user has any bookings
    const bookings = await kv.getByPrefix("booking:");
    const userBookings = bookings.filter(b => b.userId === userId);
    
    if (userBookings.length > 0) {
      return c.json({ 
        error: `Cannot delete user with existing bookings. Please delete ${userBookings.length} booking(s) first.` 
      }, 400);
    }
    
    await kv.del(userKey);
    
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting user:", error);
    return c.json({ error: `Failed to delete user: ${error}` }, 500);
  }
});

// Get Twilio configuration
app.get("/make-server-82b8c834/twilio-config", async (c) => {
  try {
    const config = await kv.get("twilio_config");
    
    if (config) {
      // Return config with masked auth token for security
      return c.json({ 
        config: {
          accountSid: config.accountSid,
          phoneNumber: config.phoneNumber,
          authToken: config.authToken ? '••••••••••••••••' : ''
        }
      });
    }
    
    return c.json({ config: null });
  } catch (error) {
    console.log("Error fetching Twilio config:", error);
    return c.json({ error: `Failed to fetch config: ${error}` }, 500);
  }
});

// Save Twilio configuration
app.post("/make-server-82b8c834/twilio-config", async (c) => {
  try {
    const { config } = await c.req.json();
    
    if (!config || !config.accountSid || !config.authToken || !config.phoneNumber) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    
    // Validate phone number format
    if (!config.phoneNumber.startsWith('+')) {
      return c.json({ error: "Phone number must start with + (e.g., +1234567890)" }, 400);
    }
    
    // Get existing config to preserve auth token if it's masked
    const existingConfig = await kv.get("twilio_config");
    
    // If auth token is masked, keep the existing one
    const authToken = config.authToken === '••••••••••••••••' && existingConfig?.authToken
      ? existingConfig.authToken
      : config.authToken;
    
    const twilioConfig = {
      accountSid: config.accountSid,
      authToken: authToken,
      phoneNumber: config.phoneNumber,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set("twilio_config", twilioConfig);
    
    return c.json({ success: true });
  } catch (error) {
    console.log("Error saving Twilio config:", error);
    return c.json({ error: `Failed to save config: ${error}` }, 500);
  }
});

// Delete Twilio configuration
app.delete("/make-server-82b8c834/twilio-config", async (c) => {
  try {
    await kv.del("twilio_config");
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting Twilio config:", error);
    return c.json({ error: `Failed to delete config: ${error}` }, 500);
  }
});

// Test Twilio configuration by sending a test SMS
app.post("/make-server-82b8c834/twilio-test", async (c) => {
  try {
    const config = await kv.get("twilio_config");
    
    if (!config) {
      return c.json({ error: "Twilio not configured" }, 400);
    }
    
    // Get all users and find one with SMS enabled
    const users = await kv.getByPrefix("user:");
    
    // Collect all phone numbers with SMS enabled (same logic as booking notifications)
    const phoneNumbers: { phone: string; userName: string }[] = [];
    
    for (const user of users) {
      // Check primary phone
      if (user.phone && user.phone.trim() !== "" && user.primaryPhoneSmsEnabled === true) {
        phoneNumbers.push({ phone: user.phone, userName: user.name });
      }
      
      // Check secondary phones
      if (user.secondaryPhones && Array.isArray(user.secondaryPhones)) {
        for (const secondaryPhone of user.secondaryPhones) {
          if (secondaryPhone.number && secondaryPhone.smsEnabled === true) {
            phoneNumbers.push({ phone: secondaryPhone.number, userName: user.name });
          }
        }
      }
    }
    
    if (phoneNumbers.length === 0) {
      return c.json({ 
        error: "No pilots have enabled SMS notifications. Please enable SMS notifications for at least one pilot in the User Management settings." 
      }, 400);
    }
    
    // Send test message to the first phone number found
    const testNumber = phoneNumbers[0];
    const testMessage = `Test message from N4368V Aircraft Scheduler. Your SMS notifications are working! 🛩️`;
    
    try {
      await sendSMSWithConfig(testNumber.phone, testMessage, config);
      return c.json({ 
        success: true, 
        message: `Test SMS sent successfully to ${testNumber.userName} (${testNumber.phone})` 
      });
    } catch (smsError: any) {
      console.log("SMS send error:", smsError);
      return c.json({ 
        error: `Failed to send SMS: ${smsError.message || smsError}` 
      }, 500);
    }
  } catch (error) {
    console.log("Error testing Twilio:", error);
    return c.json({ error: `Failed to test: ${error}` }, 500);
  }
});

// Helper function to send SMS notifications
async function sendBookingNotifications(booking: any) {
  console.log("=== SENDING BOOKING NOTIFICATIONS ===");
  console.log("Booking object:", booking);
  console.log("Booking startTime:", booking.startTime, "Type:", typeof booking.startTime);
  console.log("Booking endTime:", booking.endTime, "Type:", typeof booking.endTime);
  
  // Get Twilio configuration from KV store
  const twilioConfig = await kv.get("twilio_config");
  
  if (!twilioConfig || !twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.phoneNumber) {
    console.log("Twilio not configured. Skipping SMS notifications.");
    return;
  }
  
  // Fetch all users
  const users = await kv.getByPrefix("user:");
  
  // Process each user and send personalized SMS based on their time format preference
  for (const user of users) {
    const phonesToNotify: string[] = [];
    
    // Check primary phone
    if (user.phone && user.phone.trim() !== "" && user.primaryPhoneSmsEnabled === true) {
      phonesToNotify.push(user.phone);
    }
    
    // Check secondary phones
    if (user.secondaryPhones && Array.isArray(user.secondaryPhones)) {
      for (const secondaryPhone of user.secondaryPhones) {
        if (secondaryPhone.number && secondaryPhone.smsEnabled === true) {
          phonesToNotify.push(secondaryPhone.number);
        }
      }
    }
    
    // Skip if this user has no phones to notify
    if (phonesToNotify.length === 0) {
      continue;
    }
    
    // Get user's time format preference (default to 12h)
    const timeFormat = user.timeFormat || '12h';
    
    // Get user's timezone preference (default to 'America/Los_Angeles')
    const timezone = user.timezone || 'America/Los_Angeles';
    
    // Format dates based on user's preference
    const startDate = new Date(booking.startTime);
    const endDate = new Date(booking.endTime);
    
    console.log(`For user ${user.name}:`);
    console.log("  startDate object:", startDate, "Valid?", !isNaN(startDate.getTime()));
    console.log("  endDate object:", endDate, "Valid?", !isNaN(endDate.getTime()));
    
    let startFormatted: string;
    let endFormatted: string;
    
    if (timeFormat === '24h') {
      // 24-hour format: "Mon Mar 01, 12:00"
      startFormatted = startDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone
      });
      
      // "15:00"
      endFormatted = endDate.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone
      });
    } else {
      // 12-hour format: "Mon Mar 01, 12:00 PM"
      startFormatted = startDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: timezone
      });
      
      // "3:00 PM"
      endFormatted = endDate.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: timezone
      });
    }
    
    // Prepare SMS message - differentiate between requests and regular bookings
    let message: string;
    if (booking.isRequest && !booking.acceptedBy) {
      // This is an unaccepted request
      message = `Aircraft N4368V Booking REQUEST: ${booking.requestedByName || booking.userName} has a flight request for ${startFormatted} to ${endFormatted}. ${booking.title}${booking.notes ? ` - ${booking.notes}` : ''}`;
    } else {
      // This is a regular booking or accepted request
      message = `Aircraft N4368V Booking Alert: ${booking.userName} scheduled from ${startFormatted} to ${endFormatted}. ${booking.title}${booking.notes ? ` - ${booking.notes}` : ''}`;
    }
    
    // Send SMS to each phone for this user
    for (const phone of phonesToNotify) {
      try {
        await sendSMSWithConfig(phone, message, twilioConfig);
        console.log(`SMS sent to ${user.name} (${phone}) in ${timeFormat} format`);
      } catch (smsError) {
        console.log(`Failed to send SMS to ${user.name} (${phone}):`, smsError);
      }
    }
  }
}

// Helper function to send cancellation SMS notifications
async function sendCancellationNotifications(booking: any) {
  // Get Twilio configuration from KV store
  const twilioConfig = await kv.get("twilio_config");
  
  if (!twilioConfig || !twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.phoneNumber) {
    console.log("Twilio not configured. Skipping SMS notifications.");
    return;
  }
  
  // Fetch all users
  const users = await kv.getByPrefix("user:");
  
  // Process each user and send personalized SMS based on their time format preference
  for (const user of users) {
    const phonesToNotify: string[] = [];
    
    // Check primary phone
    if (user.phone && user.phone.trim() !== "" && user.primaryPhoneSmsEnabled === true) {
      phonesToNotify.push(user.phone);
    }
    
    // Check secondary phones
    if (user.secondaryPhones && Array.isArray(user.secondaryPhones)) {
      for (const secondaryPhone of user.secondaryPhones) {
        if (secondaryPhone.number && secondaryPhone.smsEnabled === true) {
          phonesToNotify.push(secondaryPhone.number);
        }
      }
    }
    
    // Skip if this user has no phones to notify
    if (phonesToNotify.length === 0) {
      continue;
    }
    
    // Get user's time format preference (default to 12h)
    const timeFormat = user.timeFormat || '12h';
    
    // Get user's timezone preference (default to 'America/Los_Angeles')
    const timezone = user.timezone || 'America/Los_Angeles';
    
    // Format dates based on user's preference
    const startDate = new Date(booking.startTime);
    const endDate = new Date(booking.endTime);
    
    let startFormatted: string;
    let endFormatted: string;
    
    if (timeFormat === '24h') {
      // 24-hour format: "Mon Mar 01, 12:00"
      startFormatted = startDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone
      });
      
      // "15:00"
      endFormatted = endDate.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone
      });
    } else {
      // 12-hour format: "Mon Mar 01, 12:00 PM"
      startFormatted = startDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: timezone
      });
      
      // "3:00 PM"
      endFormatted = endDate.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: timezone
      });
    }
    
    // Prepare SMS message
    const message = `Aircraft N4368V Booking Cancellation: ${booking.userName}'s booking from ${startFormatted} to ${endFormatted} has been cancelled. ${booking.title}${booking.notes ? ` - ${booking.notes}` : ''}`;
    
    // Send SMS to each phone for this user
    for (const phone of phonesToNotify) {
      try {
        await sendSMSWithConfig(phone, message, twilioConfig);
        console.log(`SMS sent to ${user.name} (${phone}) in ${timeFormat} format`);
      } catch (smsError) {
        console.log(`Failed to send SMS to ${user.name} (${phone}):`, smsError);
      }
    }
  }
}

// Helper function to send acceptance SMS notifications
async function sendAcceptanceNotifications(booking: any) {
  // Get Twilio configuration from KV store
  const twilioConfig = await kv.get("twilio_config");
  
  if (!twilioConfig || !twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.phoneNumber) {
    console.log("Twilio not configured. Skipping SMS notifications.");
    return;
  }
  
  // Fetch all users
  const users = await kv.getByPrefix("user:");
  
  // Process each user and send personalized SMS based on their time format preference
  for (const user of users) {
    const phonesToNotify: string[] = [];
    
    // Check primary phone
    if (user.phone && user.phone.trim() !== "" && user.primaryPhoneSmsEnabled === true) {
      phonesToNotify.push(user.phone);
    }
    
    // Check secondary phones
    if (user.secondaryPhones && Array.isArray(user.secondaryPhones)) {
      for (const secondaryPhone of user.secondaryPhones) {
        if (secondaryPhone.number && secondaryPhone.smsEnabled === true) {
          phonesToNotify.push(secondaryPhone.number);
        }
      }
    }
    
    // Skip if this user has no phones to notify
    if (phonesToNotify.length === 0) {
      continue;
    }
    
    // Get user's time format preference (default to 12h)
    const timeFormat = user.timeFormat || '12h';
    
    // Get user's timezone preference (default to 'America/Los_Angeles')
    const timezone = user.timezone || 'America/Los_Angeles';
    
    // Format dates based on user's preference
    const startDate = new Date(booking.startTime);
    const endDate = new Date(booking.endTime);
    
    let startFormatted: string;
    let endFormatted: string;
    
    if (timeFormat === '24h') {
      startFormatted = startDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone
      });
      
      endFormatted = endDate.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone
      });
    } else {
      startFormatted = startDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: timezone
      });
      
      endFormatted = endDate.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: timezone
      });
    }
    
    // Prepare SMS message for acceptance
    const message = `Aircraft N4368V Booking REQUEST ACCEPTED: ${booking.userName} accepted ${booking.requestedByName}'s flight request from ${startFormatted} to ${endFormatted}. ${booking.title}${booking.notes ? ` - ${booking.notes}` : ''}`;
    
    // Send SMS to each phone for this user
    for (const phone of phonesToNotify) {
      try {
        await sendSMSWithConfig(phone, message, twilioConfig);
        console.log(`SMS sent to ${user.name} (${phone}) in ${timeFormat} format`);
      } catch (smsError) {
        console.log(`Failed to send SMS to ${user.name} (${phone}):`, smsError);
      }
    }
  }
}

// Helper function to send SMS using Twilio config
async function sendSMSWithConfig(phone: string, message: string, config: any) {
  const twilioAccountSid = config.accountSid;
  const twilioAuthToken = config.authToken;
  const twilioPhoneNumber = config.phoneNumber;
  
  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    console.log('Twilio credentials not configured. Skipping SMS.');
    return { success: false, message: 'Twilio not configured' };
  }
  
  try {
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phone,
          From: twilioPhoneNumber,
          Body: message,
        }),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Twilio API error: ${errorData}`);
    }
    
    const data = await response.json();
    console.log(`SMS sent successfully via Twilio: ${data.sid}`);
    return { success: true, sid: data.sid };
  } catch (error) {
    console.error('Error sending SMS via Twilio:', error);
    throw error;
  }
}

// Get all day notes
app.get("/make-server-82b8c834/day-notes", async (c) => {
  try {
    const notes = await kv.getByPrefix("daynote:");
    return c.json(notes);
  } catch (error) {
    console.log("Error fetching day notes:", error);
    return c.json({ error: `Failed to fetch day notes: ${error}` }, 500);
  }
});

// Create or update a day note
app.post("/make-server-82b8c834/day-notes", async (c) => {
  try {
    const noteData = await c.req.json();
    const { date, note, blocksScheduling, createdBy, createdByName } = noteData;
    
    // Validate required fields
    if (!date || !note) {
      return c.json({ error: "Missing required fields: date, note" }, 400);
    }
    
    const noteId = `daynote:${date}`;
    const newNote = {
      id: noteId,
      date,
      note,
      blocksScheduling: blocksScheduling || false,
      createdBy,
      createdByName,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(noteId, newNote);
    
    return c.json({ success: true, note: newNote });
  } catch (error) {
    console.log("Error creating day note:", error);
    return c.json({ error: `Failed to create day note: ${error}` }, 500);
  }
});

// Delete a day note
app.delete("/make-server-82b8c834/day-notes/:id", async (c) => {
  try {
    const noteId = c.req.param("id");
    
    const note = await kv.get(noteId);
    if (!note) {
      return c.json({ error: "Day note not found" }, 404);
    }
    
    await kv.del(noteId);
    
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting day note:", error);
    return c.json({ error: `Failed to delete day note: ${error}` }, 500);
  }
});

// Accept a booking request
app.post("/make-server-82b8c834/bookings/:id/accept", async (c) => {
  try {
    const bookingId = c.req.param("id");
    const { acceptedBy, acceptedByName, acceptedByColor } = await c.req.json();
    
    // Get existing booking
    const booking = await kv.get(bookingId);
    
    if (!booking) {
      return c.json({ error: "Booking not found" }, 404);
    }
    
    if (!booking.isRequest) {
      return c.json({ error: "This is not a booking request" }, 400);
    }
    
    if (booking.acceptedBy) {
      return c.json({ error: "This request has already been accepted" }, 400);
    }
    
    // Check for conflicts now that it's being accepted
    const allBookings = await kv.getByPrefix("booking:");
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    
    for (const b of allBookings) {
      // Skip checking against itself
      if (b.id === bookingId) {
        continue;
      }
      
      // Skip unaccepted requests and notes
      if ((b.isRequest && !b.acceptedBy) || b.userId === 'note') {
        continue;
      }
      
      const bookingStart = new Date(b.startTime);
      const bookingEnd = new Date(b.endTime);
      
      // Check if times overlap
      if ((start < bookingEnd && end > bookingStart)) {
        return c.json({ 
          error: `Booking conflict with ${b.userName}'s booking from ${bookingStart.toLocaleString()} to ${bookingEnd.toLocaleString()}` 
        }, 409);
      }
    }
    
    // Update booking with acceptance
    const updatedBooking = {
      ...booking,
      acceptedBy,
      userId: acceptedBy, // Transfer ownership
      userName: acceptedByName,
      userColor: acceptedByColor
    };
    
    await kv.set(bookingId, updatedBooking);
    
    // Send acceptance notification
    try {
      await sendAcceptanceNotifications(updatedBooking);
    } catch (smsError) {
      console.log("SMS acceptance notification error (non-fatal):", smsError);
    }
    
    return c.json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.log("Error accepting booking request:", error);
    return c.json({ error: `Failed to accept booking request: ${error}` }, 500);
  }
});

// ── Destinations ──────────────────────────────────────────────

app.get("/make-server-82b8c834/destinations", async (c) => {
  try {
    const { data, error } = await supabase
      .from("destinations")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return c.json(data ?? []);
  } catch (error) {
    console.log("Error fetching destinations:", error);
    return c.json({ error: `Failed to fetch destinations: ${error}` }, 500);
  }
});

app.post("/make-server-82b8c834/destinations", async (c) => {
  try {
    const body = await c.req.json();
    const { icao, name } = body ?? {};
    if (!icao || !name) {
      return c.json({ error: "icao and name are required" }, 400);
    }

    const { data: maxRow } = await supabase
      .from("destinations")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort = (maxRow?.sort_order ?? 0) + 1;

    const { data, error } = await supabase
      .from("destinations")
      .insert({ icao: String(icao).toUpperCase(), name, sort_order: nextSort })
      .select()
      .single();
    if (error) throw error;
    return c.json(data);
  } catch (error) {
    console.log("Error creating destination:", error);
    return c.json({ error: `Failed to create destination: ${error}` }, 500);
  }
});

app.delete("/make-server-82b8c834/destinations/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { error } = await supabase.from("destinations").delete().eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting destination:", error);
    return c.json({ error: `Failed to delete destination: ${error}` }, 500);
  }
});

// ── Flights ───────────────────────────────────────────────────

app.get("/make-server-82b8c834/flights", async (c) => {
  try {
    const pilotId = c.req.query("pilot_id");
    const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10) || 50, 500);
    const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;

    let query = supabase
      .from("flights")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (pilotId) query = query.eq("pilot_id", pilotId);

    const { data, error } = await query;
    if (error) throw error;
    return c.json(data ?? []);
  } catch (error) {
    console.log("Error fetching flights:", error);
    return c.json({ error: `Failed to fetch flights: ${error}` }, 500);
  }
});

app.get("/make-server-82b8c834/flights/totals", async (c) => {
  try {
    const { data: flights, error } = await supabase
      .from("flights")
      .select("pilot_id, pilot_name, hobbs_used, tach_used, hobbs_end, tach_end, created_at, date")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;

    const list = flights ?? [];

    const annual = await getAnnualBaseline();
    const oil_due_tach = await getOilDueTach();

    let total_hobbs = 0;
    let total_tach = 0;
    let since_annual_hobbs = 0;
    let since_annual_tach = 0;
    const byPilotMap = new Map<
      string,
      { pilot_id: string; pilot_name: string; hobbs: number; tach: number; count: number }
    >();

    for (const f of list) {
      const hu = Number(f.hobbs_used ?? 0);
      const tu = Number(f.tach_used ?? 0);
      total_hobbs += hu;
      total_tach += tu;

      const isSinceAnnual = f.date >= annual.date;
      if (isSinceAnnual) {
        since_annual_hobbs += hu;
        since_annual_tach += tu;
        const entry = byPilotMap.get(f.pilot_id) ?? {
          pilot_id: f.pilot_id,
          pilot_name: f.pilot_name,
          hobbs: 0,
          tach: 0,
          count: 0,
        };
        entry.hobbs += hu;
        entry.tach += tu;
        entry.count += 1;
        byPilotMap.set(f.pilot_id, entry);
      }
    }

    const by_pilot = Array.from(byPilotMap.values()).map((p) => ({
      ...p,
      hobbs: Math.round(p.hobbs * 10) / 10,
      tach: Math.round(p.tach * 10) / 10,
    }));

    const current_tach =
      list.length > 0 ? Number(list[0].tach_end) : annual.tach;
    const tach_remaining = Math.round((oil_due_tach - current_tach) * 10) / 10;

    return c.json({
      total_hobbs: Math.round(total_hobbs * 10) / 10,
      total_tach: Math.round(total_tach * 10) / 10,
      since_annual_hobbs: Math.round(since_annual_hobbs * 10) / 10,
      since_annual_tach: Math.round(since_annual_tach * 10) / 10,
      annual_date: annual.date,
      annual_hobbs: annual.hobbs,
      annual_tach: annual.tach,
      by_pilot,
      oil_due_tach,
      current_tach,
      tach_remaining,
    });
  } catch (error) {
    console.log("Error computing totals:", error);
    return c.json({ error: `Failed to compute totals: ${error}` }, 500);
  }
});

app.get("/make-server-82b8c834/flights/last-reading", async (c) => {
  try {
    const { data, error } = await supabase
      .from("flights")
      .select("hobbs_end, tach_end, date, created_at")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return c.json({ hobbs_end: 0, tach_end: 0 });
    return c.json({ hobbs_end: Number(data.hobbs_end), tach_end: Number(data.tach_end) });
  } catch (error) {
    console.log("Error fetching last reading:", error);
    return c.json({ error: `Failed to fetch last reading: ${error}` }, 500);
  }
});

app.get("/make-server-82b8c834/flights/export", async (c) => {
  try {
    const format = c.req.query("format") ?? "csv";
    if (format !== "csv") {
      return c.json({ error: "Only csv format supported" }, 400);
    }

    const { data, error } = await supabase
      .from("flights")
      .select("*")
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;

    const rows = data ?? [];
    const headers = [
      "date",
      "pilot",
      "destination",
      "hobbs_end",
      "tach_end",
      "hobbs_used",
      "tach_used",
      "notes",
    ];
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const f of rows) {
      lines.push(
        [
          f.date,
          f.pilot_name,
          f.destination,
          f.hobbs_end,
          f.tach_end,
          f.hobbs_used ?? "",
          f.tach_used ?? "",
          f.notes ?? "",
        ]
          .map(esc)
          .join(",")
      );
    }
    const csv = lines.join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="n4368v-flights.csv"',
      },
    });
  } catch (error) {
    console.log("Error exporting flights:", error);
    return c.json({ error: `Failed to export flights: ${error}` }, 500);
  }
});

app.post("/make-server-82b8c834/flights", async (c) => {
  try {
    const body = await c.req.json();
    const { pilot_id, pilot_name, date, destination, hobbs_end, tach_end, notes, photo_url } = body ?? {};

    if (!pilot_id || !pilot_name || !date || !destination || hobbs_end === undefined || tach_end === undefined) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const hobbsEndNum = Number(hobbs_end);
    const tachEndNum = Number(tach_end);

    // Chronological predecessor: latest flight whose date <= new flight's date.
    // For same-date flights, ties broken by created_at desc. Falls back to the
    // annual baseline if no prior flight exists, so bulk-entered first flights
    // get a correct delta from the annual instead of a zero.
    const { data: last } = await supabase
      .from("flights")
      .select("hobbs_end, tach_end, date, created_at")
      .lte("date", String(date))
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const annual = await getAnnualBaseline();
    const prevHobbs = last ? Number(last.hobbs_end) : annual.hobbs;
    const prevTach = last ? Number(last.tach_end) : annual.tach;
    const hobbs_used = Math.round((hobbsEndNum - prevHobbs) * 10) / 10;
    const tach_used = Math.round((tachEndNum - prevTach) * 10) / 10;

    const { data, error } = await supabase
      .from("flights")
      .insert({
        pilot_id,
        pilot_name,
        date,
        destination: String(destination).toUpperCase(),
        hobbs_end: hobbsEndNum,
        tach_end: tachEndNum,
        hobbs_used,
        tach_used,
        notes: notes ?? null,
        photo_url: photo_url ?? null,
      })
      .select()
      .single();
    if (error) throw error;

    return c.json(data);
  } catch (error) {
    console.log("Error creating flight:", error);
    return c.json({ error: `Failed to create flight: ${error}` }, 500);
  }
});

app.delete("/make-server-82b8c834/flights/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { error } = await supabase.from("flights").delete().eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting flight:", error);
    return c.json({ error: `Failed to delete flight: ${error}` }, 500);
  }
});

// ── AI Gauge Reading ──────────────────────────────────────────

app.post("/make-server-82b8c834/read-gauges", async (c) => {
  try {
    const body = await c.req.json();
    const { image_base64, media_type } = body ?? {};
    if (!image_base64 || !media_type) {
      return c.json({ error: "image_base64 and media_type are required" }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return c.json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
    }

    const prompt =
      `You are reading aircraft instrument gauges from a cockpit photo.\n` +
      `Find the Hobbs meter (elapsed time, shows decimal hours like 456.3) \n` +
      `and the Tach meter (RPM/hours display showing engine time like 61.0).\n` +
      `Return ONLY valid JSON: {"hobbs": 96.8, "tach": 63.1, "confidence": "high"}\n` +
      `If you cannot read a value clearly, use null and set confidence to "low".`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type, data: image_base64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.log("Anthropic API error:", resp.status, errText);
      return c.json({ error: `Anthropic API ${resp.status}`, detail: errText }, 502);
    }

    const result = await resp.json();
    const text: string = result?.content?.[0]?.text ?? "";

    let parsed: { hobbs: number | null; tach: number | null; confidence: "high" | "low" };
    try {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : text);
    } catch (_e) {
      parsed = { hobbs: null, tach: null, confidence: "low" };
    }

    return c.json(parsed);
  } catch (error) {
    console.log("Error reading gauges:", error);
    return c.json({ error: `Failed to read gauges: ${error}` }, 500);
  }
});

Deno.serve(app.fetch);