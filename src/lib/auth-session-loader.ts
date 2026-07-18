export type AuthUserIdentity = {
  id: string;
  email?: string;
};

type AuthSessionLoaderOptions<TUser extends AuthUserIdentity> = {
  getSessionUserId: () => Promise<string | null>;
  loadRoles: (userId: string) => Promise<string[]>;
  loadDisplayName: (userId: string) => Promise<string | null>;
  loadUser: (userId: string) => Promise<TUser | null>;
  loadEodStatus: (userId: string, roles: string[]) => Promise<boolean>;
  onLoading: (userId: string) => void;
  onSignedOut: () => void;
  onCommit: (account: {
    userId: string;
    user: TUser;
    roles: string[];
    displayName: string | null;
    shouldLand: boolean;
  }) => void;
  onEodStatus: (userId: string, submitted: boolean) => void;
  onAuthError: (error: Error) => void;
  onEodError: (userId: string, error: Error) => void;
};

type TransitionOptions = {
  wantsLanding?: boolean;
};

const toError = (error: unknown) => error instanceof Error ? error : new Error(String(error));

export function isolateAuthBoundaryCache(cache: { clear: () => void }) {
  cache.clear();
  return () => cache.clear();
}

export async function signOutWithLocalFallback(
  signOut: (options?: { scope: "local" }) => Promise<{ error: unknown }>,
) {
  let error: unknown;
  try {
    ({ error } = await signOut());
  } catch (caught) {
    error = caught;
  }
  if (!error) return null;
  try {
    const { error: localError } = await signOut({ scope: "local" });
    return localError ? toError(localError) : null;
  } catch (caught) {
    return toError(caught);
  }
}

export function createAuthSessionLoader<TUser extends AuthUserIdentity>(
  options: AuthSessionLoaderOptions<TUser>,
) {
  let latestRequest = 0;
  let committedUserId: string | null = null;
  let observedUserId: string | null = null;
  let pendingLandingUserId: string | null = null;
  let unobservedLandingRequested = false;
  let eodRevision = 0;
  let disposed = false;

  const reserve = () => {
    latestRequest += 1;
    return latestRequest;
  };

  const isCurrent = (requestId: number) => !disposed && requestId === latestRequest;

  const failAuth = (requestId: number, error: unknown) => {
    if (!isCurrent(requestId)) return;
    committedUserId = null;
    observedUserId = null;
    pendingLandingUserId = null;
    unobservedLandingRequested = false;
    eodRevision += 1;
    options.onAuthError(toError(error));
  };

  const resolveEod = async (
    requestId: number,
    userId: string,
    roles: string[],
    requestEodRevision: number,
  ) => {
    try {
      const submitted = await options.loadEodStatus(userId, roles);
      if (
        isCurrent(requestId)
        && committedUserId === userId
        && observedUserId === userId
        && requestEodRevision === eodRevision
      ) {
        options.onEodStatus(userId, submitted);
      }
    } catch (error) {
      if (
        isCurrent(requestId)
        && committedUserId === userId
        && observedUserId === userId
        && requestEodRevision === eodRevision
      ) {
        options.onEodError(userId, toError(error));
      }
    }
  };

  const resolveAccount = async (requestId: number, userId: string) => {
    try {
      const [roles, displayName, user] = await Promise.all([
        options.loadRoles(userId),
        options.loadDisplayName(userId),
        options.loadUser(userId),
      ]);
      if (!isCurrent(requestId) || observedUserId !== userId) return;
      if (!user || user.id !== userId) {
        throw new Error("Verified user identity does not match the active session.");
      }

      const shouldLand = pendingLandingUserId === userId;
      committedUserId = userId;
      if (shouldLand) pendingLandingUserId = null;
      options.onCommit({ userId, user, roles, displayName, shouldLand });

      const requestEodRevision = eodRevision;
      void resolveEod(requestId, userId, roles, requestEodRevision);
    } catch (error) {
      failAuth(requestId, error);
    }
  };

  const observe = (
    requestId: number,
    userId: string | null,
    { wantsLanding = false }: TransitionOptions = {},
  ) => {
    if (!isCurrent(requestId)) return;

    if (!userId) {
      committedUserId = null;
      observedUserId = null;
      pendingLandingUserId = null;
      unobservedLandingRequested = false;
      eodRevision += 1;
      options.onSignedOut();
      return;
    }

    const landingRequested = wantsLanding || unobservedLandingRequested;
    unobservedLandingRequested = false;
    const observationChanged = observedUserId !== userId;
    if (observationChanged && pendingLandingUserId !== userId) {
      pendingLandingUserId = null;
    }
    if (landingRequested && (observationChanged || committedUserId !== userId)) {
      pendingLandingUserId = userId;
    }
    if (observationChanged && committedUserId !== null && committedUserId !== userId) {
      eodRevision += 1;
      options.onLoading(userId);
    }
    observedUserId = userId;
    void resolveAccount(requestId, userId);
  };

  return {
    refresh(optionsForRefresh: TransitionOptions = {}) {
      if (optionsForRefresh.wantsLanding) unobservedLandingRequested = true;
      const requestId = reserve();
      void options.getSessionUserId()
        .then(userId => observe(requestId, userId, optionsForRefresh))
        .catch(error => failAuth(requestId, error));
    },
    transition(userId: string | null, optionsForTransition: TransitionOptions = {}) {
      const requestId = reserve();
      observe(requestId, userId, optionsForTransition);
    },
    recordEodSubmitted(userId: string) {
      if (disposed || committedUserId !== userId || observedUserId !== userId) return false;
      eodRevision += 1;
      options.onEodStatus(userId, true);
      return true;
    },
    dispose() {
      disposed = true;
      reserve();
    },
  };
}
