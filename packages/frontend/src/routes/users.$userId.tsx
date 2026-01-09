import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../lib/useSession';
import { userQueryOptions, userDebatesQueryOptions } from '../lib/queries';
import { SkeletonStatCard, Skeleton } from '../components';
import type { Debate } from '@debate-platform/shared';

export const Route = createFileRoute('/users/$userId')({
  loader: async ({ context, params }) => {
    const user = await context.queryClient.ensureQueryData(
      userQueryOptions(params.userId)
    );
    return { user };
  },
  pendingComponent: UserProfilePending,
  pendingMs: 200,
  component: UserProfile,
});

/**
 * UserProfile page displaying reputation, prediction accuracy, and debate history
 * Requirements: 7.5, 15.5
 */
function UserProfile() {
  const { user } = Route.useLoaderData();
  const { userId } = Route.useParams();
  const { user: currentUser } = useSession();
  
  // Fetch debate history
  const { data: debates = [] } = useQuery(userDebatesQueryOptions(userId));
  
  const isOwnProfile = currentUser?.id === user?.authUserId;

  if (!user) {
    return (
      <div className="min-h-screen bg-page-bg">
        <div className="max-w-paper mx-auto px-6 py-12">
          <div className="bg-paper rounded-small border border-black/[0.08] shadow-paper p-8 text-center">
            <h2 className="font-heading text-heading-2 text-text-primary">User not found</h2>
            <p className="mt-3 text-body text-text-secondary">
              The user profile you're looking for doesn't exist.
            </p>
            <Link
              to="/"
              className="mt-6 inline-block px-4 py-2 bg-text-primary text-paper font-medium rounded-subtle hover:bg-text-primary/90 transition-colors"
            >
              Back to Index
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-paper mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Navigation */}
        <nav className="mb-6 sm:mb-8">
          <Link to="/" className="text-text-secondary hover:text-text-primary text-body-small transition-colors">
            ← Back to Index
          </Link>
        </nav>

        {/* Profile Header */}
        <header className="bg-paper rounded-small border border-black/[0.08] shadow-paper p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Avatar */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-text-primary rounded-subtle flex items-center justify-center text-paper text-lg sm:text-xl font-heading font-semibold flex-shrink-0">
              {user.username.charAt(0).toUpperCase()}
            </div>
            
            <div className="flex-1 min-w-0">
              <h1 className="font-heading text-xl sm:text-heading-2 text-text-primary truncate">{user.username}</h1>
              <p className="text-body-small text-text-tertiary mt-1">
                Member since {new Date(user.createdAt).toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </p>
              
              {/* Sandbox Status */}
              {!user.sandboxCompleted && (
                <div className="mt-2 sm:mt-3">
                  <span className="px-2 py-1 bg-amber-50 text-amber-700 text-caption font-medium rounded-subtle">
                    Sandbox Mode • {user.debatesParticipated}/5 debates
                  </span>
                </div>
              )}
              
              {isOwnProfile && (
                <p className="mt-2 text-caption text-text-tertiary">
                  This is your profile
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <StatCard
            label="Reputation"
            value={user.reputationScore.toFixed(0)}
            description="Based on predictions and argument impact"
          />
          <StatCard
            label="Prediction Accuracy"
            value={`${user.predictionAccuracy.toFixed(1)}%`}
            description="Stance alignment with outcomes"
          />
          <StatCard
            label="Debates"
            value={user.debatesParticipated.toString()}
            description="Total debates participated"
          />
        </section>

        {/* Vote Weight Info */}
        <section className="bg-paper rounded-small border border-black/[0.08] shadow-paper p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-label uppercase tracking-wider text-text-secondary mb-3">Vote Weight</h2>
          <div className="flex items-center gap-4">
            <div className="text-heading-1 font-heading text-text-primary">
              {user.sandboxCompleted ? '1.0×' : '0.5×'}
            </div>
            <div className="text-body-small text-text-secondary">
              {user.sandboxCompleted
                ? 'Full voting weight — votes count at full value'
                : 'Sandbox mode — complete 5 debates to unlock full weight'}
            </div>
          </div>
          
          {!user.sandboxCompleted && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-caption text-text-tertiary mb-2">
                <span>Progress to full weight</span>
                <span>{user.debatesParticipated}/5</span>
              </div>
              <div className="h-1.5 bg-page-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-text-primary transition-all"
                  style={{ width: `${(user.debatesParticipated / 5) * 100}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Debate History */}
        <section className="bg-paper rounded-small border border-black/[0.08] shadow-paper p-4 sm:p-6">
          <h2 className="text-label uppercase tracking-wider text-text-secondary mb-4">Debate History</h2>
          
          {debates.length === 0 ? (
            <p className="text-body-small text-text-tertiary">
              No debates yet. {isOwnProfile && (
                <Link to="/debates/new" className="text-accent hover:text-accent-hover">
                  Start your first debate
                </Link>
              )}
            </p>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {debates.map((debate) => (
                <DebateHistoryRow 
                  key={debate.id} 
                  debate={debate} 
                  userId={userId}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  description: string;
}

function StatCard({ label, value, description }: StatCardProps) {
  return (
    <div className="bg-paper rounded-small border border-black/[0.08] shadow-paper p-3 sm:p-4">
      <div className="text-label uppercase tracking-wider text-text-tertiary mb-1">{label}</div>
      <div className="text-xl sm:text-heading-2 font-heading text-text-primary">{value}</div>
      <div className="text-caption text-text-tertiary mt-1 hidden sm:block">{description}</div>
    </div>
  );
}

interface DebateHistoryRowProps {
  debate: Debate;
  userId: string;
}

function DebateHistoryRow({ debate, userId }: DebateHistoryRowProps) {
  const isSupport = debate.supportDebaterId === userId;
  const side = isSupport ? 'support' : 'oppose';
  
  return (
    <Link
      to="/debates/$debateId"
      params={{ debateId: debate.id }}
      className="block p-3 -mx-3 rounded-subtle hover:bg-page-bg transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Side indicator */}
        <span className={`text-label uppercase tracking-wider mt-0.5 ${
          side === 'support' ? 'text-support' : 'text-oppose'
        }`}>
          {side === 'support' ? 'For' : 'Against'}
        </span>
        
        <div className="flex-1 min-w-0">
          <p className="text-body text-text-primary truncate">
            {debate.resolution}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-caption ${
              debate.status === 'concluded' ? 'text-text-tertiary' : 'text-support'
            }`}>
              {debate.status === 'concluded' ? 'Concluded' : 'Active'}
            </span>
            <span className="text-caption text-text-tertiary">
              Round {debate.currentRound}/3
            </span>
            <span className="text-caption text-text-tertiary">
              {new Date(debate.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function UserProfilePending() {
  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-paper mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <nav className="mb-6 sm:mb-8">
          <Skeleton className="h-4 w-24" />
        </nav>

        <header className="bg-paper rounded-small border border-black/[0.08] shadow-paper p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-subtle flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-6 sm:h-7 w-40 sm:w-48" />
              <Skeleton className="h-4 w-28 sm:w-32 mt-2" />
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {[1, 2, 3].map((i) => (
            <SkeletonStatCard key={i} />
          ))}
        </section>

        <section className="bg-paper rounded-small border border-black/[0.08] shadow-paper p-4 sm:p-6">
          <Skeleton className="h-4 w-24 mb-4" />
          <div className="space-y-2 sm:space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 sm:h-16 w-full" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
