#ifndef FX_COMPOSE_READY_API_H
#define FX_COMPOSE_READY_API_H
#include "foxmail_reveal_gate.h"
#define FX_READY_MESSAGE_NAME L"FxComposeReady.Notify.43E5CD38.v1"
#define FX_READY_MESSAGE_PROP L"FxComposeReady.Message.43E5CD38.v1"
#define FX_READY_OWNER_PROP L"FxRevealGate.Owner.43E5CD38.v2"
#define FX_READY_IDENTITY_PROP L"FxRevealGate.Identity.43E5CD38.v2"
#define FX_READY_INTERVAL 40UL
#define FX_READY_TIMEOUT 1500UL
#define FX_READY_SLOTS 8
#define FX_READY_EDITOR_VMT_RVA (0xB94A54UL-0x400000UL)
#define FX_READY_EDITOR_BASE_VMT_RVA (0xB83AC4UL-0x400000UL)
#define FX_READY_HOST_VMT_RVA (0xB6716CUL-0x400000UL)
#define FX_READY_ATOM1_RVA 0xEFA1B6UL
#define FX_READY_ATOM2_RVA 0xEFA1B4UL
#define FX_READY_ATOM3_RVA 0xEF6B80UL
#define FX_READY_ATOM4_RVA 0xEF6B7EUL
typedef struct FX_READY_STATS {
 FXG_DWORD size,version,armed,active,notified,snapshotReady,readyReleased,
 timeoutReleased,closed,released,releaseFailed,retired,setupFailed,
 surfacePending,redrawFailed,callbackExceptions,posted,staleMessages;
} FX_READY_STATS;
extern FX_READY_STATS FxComposeReadyStats;
#ifdef FXG_FIXTURE
/* Snapshot: -1 invalid/not found, 0 valid loadEnd0, 1 valid loadEnd1.
 * A nonnegative result sets hostOut to the existing, owned native host HWND. */
int __stdcall FxReadyFixtureSnapshot(FXG_HWND,FXG_HWND *);
int __stdcall FxReadyFixtureSurface(FXG_HWND,FXG_HWND);
FXG_DWORD __stdcall FxReadyFixtureTick(void);
int __stdcall FxReadyFixturePin(void);
/* 1 timer evaluation; 2 ready notification using Snapshot's current host;
 * 3 close cancellation. Pump only affects a slot owned by the calling thread. */
void __stdcall FxReadyFixturePump(FXG_HWND,int);
#endif
#endif
