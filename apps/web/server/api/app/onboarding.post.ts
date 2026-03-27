import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '#layer/server/database/schema'
import { defineUserMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { publicProfiles, vesselInstallations, vessels } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'
import { getCaptainProfileByUserId, resolveUniqueVesselSlug } from '#server/utils/myboat'

const onboardingSchema = z.object({
  captainName: z.string().trim().min(2).max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]+$/)
    .min(3)
    .max(20),
  headline: z.string().trim().max(120).optional().or(z.literal('')),
  bio: z.string().trim().max(400).optional().or(z.literal('')),
  vesselName: z.string().trim().min(2).max(80),
  vesselType: z.string().trim().max(60).optional().or(z.literal('')),
  homePort: z.string().trim().max(120).optional().or(z.literal('')),
  summary: z.string().trim().max(280).optional().or(z.literal('')),
  installationLabel: z.string().trim().min(2).max(80),
  edgeHostname: z.string().trim().max(120).optional().or(z.literal('')),
  signalKUrl: z.string().trim().url().optional().or(z.literal('')),
})

export default defineUserMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.authProfile,
    parseBody: withValidatedBody(onboardingSchema.parse),
  },
  async ({ event, user, body }) => {
    const db = useAppDatabase(event)
    const now = new Date().toISOString()
    const existingProfile = await getCaptainProfileByUserId(event, user.id)

    const conflictingProfile = await db
      .select({ userId: publicProfiles.userId })
      .from(publicProfiles)
      .where(eq(publicProfiles.username, body.username))
      .get()

    if (conflictingProfile && conflictingProfile.userId !== user.id) {
      throw createError({
        statusCode: 409,
        message: 'That public profile handle is already claimed.',
      })
    }

    await db
      .update(users)
      .set({
        name: body.captainName,
        updatedAt: now,
      })
      .where(eq(users.id, user.id))

    const existingVessel = await db
      .select()
      .from(vessels)
      .where(eq(vessels.ownerUserId, user.id))
      .orderBy(desc(vessels.isPrimary), desc(vessels.createdAt))
      .get()

    const vesselId = existingVessel?.id || crypto.randomUUID()
    const vesselSlug = await resolveUniqueVesselSlug(
      event,
      user.id,
      body.vesselName,
      existingVessel?.id,
    )

    if (existingProfile) {
      await db
        .update(publicProfiles)
        .set({
          username: body.username,
          headline: body.headline || null,
          bio: body.bio || null,
          homePort: body.homePort || null,
          updatedAt: now,
        })
        .where(eq(publicProfiles.userId, user.id))
    } else {
      await db.insert(publicProfiles).values({
        userId: user.id,
        username: body.username,
        headline: body.headline || null,
        bio: body.bio || null,
        homePort: body.homePort || null,
        shareProfile: true,
        createdAt: now,
        updatedAt: now,
      })
    }

    if (existingVessel) {
      await db
        .update(vessels)
        .set({
          slug: vesselSlug,
          name: body.vesselName,
          vesselType: body.vesselType || null,
          homePort: body.homePort || null,
          summary: body.summary || null,
          isPrimary: true,
          sharePublic: true,
          updatedAt: now,
        })
        .where(eq(vessels.id, existingVessel.id))
    } else {
      await db.insert(vessels).values({
        id: vesselId,
        ownerUserId: user.id,
        slug: vesselSlug,
        name: body.vesselName,
        vesselType: body.vesselType || null,
        homePort: body.homePort || null,
        summary: body.summary || null,
        isPrimary: true,
        sharePublic: true,
        createdAt: now,
        updatedAt: now,
      })
    }

    const currentVesselId = existingVessel?.id || vesselId
    const existingInstallation = await db
      .select({ id: vesselInstallations.id })
      .from(vesselInstallations)
      .where(eq(vesselInstallations.vesselId, currentVesselId))
      .get()

    if (existingInstallation) {
      await db
        .update(vesselInstallations)
        .set({
          label: body.installationLabel,
          edgeHostname: body.edgeHostname || null,
          signalKUrl: body.signalKUrl || null,
          updatedAt: now,
        })
        .where(eq(vesselInstallations.id, existingInstallation.id))
    } else {
      await db.insert(vesselInstallations).values({
        id: crypto.randomUUID(),
        vesselId: currentVesselId,
        label: body.installationLabel,
        edgeHostname: body.edgeHostname || null,
        signalKUrl: body.signalKUrl || null,
        connectionState: 'pending',
        eventCount: 0,
        createdAt: now,
        updatedAt: now,
      })
    }

    const session = await getUserSession(event)
    if (session?.user) {
      await replaceUserSession(event, {
        ...session,
        user: {
          ...session.user,
          name: body.captainName,
        },
      })
    }

    return {
      ok: true,
      redirectTo: `/dashboard/vessels/${vesselSlug}`,
      username: body.username,
    }
  },
)
