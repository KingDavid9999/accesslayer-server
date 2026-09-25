import { prisma } from '../../utils/prisma.utils';

const MAX_ATTEMPTS = 3;

function delay(milliseconds: number): Promise<void> {
   return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export async function persistCirculatingSupply(creatorId: string): Promise<number> {
   let lastError: unknown;
   for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
         let supply = 0;
         await prisma.$transaction(async transaction => {
            const activities = await transaction.activity.findMany({
               where: { creatorId, type: { in: ['KEY_BOUGHT', 'KEY_SOLD'] } },
               select: { type: true, payload: true },
            });
            supply = activities.reduce((total, activity) => {
               const amount = Number((activity.payload as { amount?: number }).amount ?? 0);
               return activity.type === 'KEY_BOUGHT' ? total + amount : total - amount;
            }, 0);
            await transaction.creatorProfile.update({
               where: { id: creatorId },
               data: { circulatingSupply: supply },
            });
         });
         return supply;
      } catch (error) {
         lastError = error;
         if (attempt < MAX_ATTEMPTS - 1) {
            await delay(100 * 2 ** attempt);
         }
      }
   }
   throw lastError;
}