#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(EdgeLoader, NSObject)

RCT_EXTERN_METHOD(getModelID:(RCTPromiseResolveBlock)resolve
                 withRejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end