import {
  AdMob,
  BannerAdSize,
  BannerAdPosition,
} from '@capacitor-community/admob';
import type {
  RewardAdOptions,
} from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// Official Google Sample Ad Unit IDs for testing
export const TEST_AD_UNITS = {
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
};

// Live Production Ad Unit IDs (RTI EXPRESS Spot news 24x7)
export const PRODUCTION_AD_UNITS = {
  android: {
    banner: 'ca-app-pub-5229942501184833/8543502633',
    interstitial: 'ca-app-pub-5229942501184833/3374936437',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
};

class AdMobService {
  private isInitialized = false;
  private isPreparingInterstitial = false;
  private isInterstitialReady = false;
  private clippingViewCounter = 0;
  private readonly CLIPPINGS_PER_AD = 3;

  /**
   * Initializes the Google AdMob SDK.
   * Safe to call multiple times.
   */
  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.isInitialized) {
      return;
    }

    try {
      await AdMob.initialize({
        initializeForTesting: false,
      });
      this.isInitialized = true;
      console.log('✅ Google AdMob initialized successfully');

      // Pre-load the first interstitial ad so it's ready when needed
      this.preloadInterstitial();
      // Show sticky banner ad
      this.showBanner();
    } catch (error) {
      console.error('❌ Failed to initialize Google AdMob:', error);
      // Attempt fallback initialization with testing enabled
      try {
        await AdMob.initialize({ initializeForTesting: true });
        this.isInitialized = true;
        this.preloadInterstitial();
        this.showBanner();
      } catch (e) {
        console.warn('Fallback AdMob initialization error:', e);
      }
    }
  }

  /**
   * Prepares/caches an interstitial ad in background memory.
   * Automatically falls back to Google's official test ad unit if production ad unit returns no-fill or error.
   */
  async preloadInterstitial(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.isPreparingInterstitial || this.isInterstitialReady) {
      return;
    }

    this.isPreparingInterstitial = true;
    const isAndroid = Capacitor.getPlatform() === 'android';

    try {
      const prodAdId = isAndroid ? PRODUCTION_AD_UNITS.android.interstitial : PRODUCTION_AD_UNITS.ios.interstitial;
      await AdMob.prepareInterstitial({
        adId: prodAdId,
        isTesting: false,
      });
      this.isInterstitialReady = true;
      console.log('✅ Production interstitial ad preloaded');
    } catch (error) {
      console.warn('⚠️ Could not preload production interstitial (falling back to test ad unit):', error);
      try {
        const testAdId = isAndroid ? TEST_AD_UNITS.android.interstitial : TEST_AD_UNITS.ios.interstitial;
        await AdMob.prepareInterstitial({
          adId: testAdId,
          isTesting: true,
        });
        this.isInterstitialReady = true;
        console.log('✅ Fallback test interstitial ad preloaded');
      } catch (fallbackError) {
        console.warn('⚠️ Fallback interstitial also failed:', fallbackError);
        this.isInterstitialReady = false;
      }
    } finally {
      this.isPreparingInterstitial = false;
    }
  }

  /**
   * Displays an interstitial full-screen ad.
   */
  async showInterstitial(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[Web Mock] Interstitial ad triggered');
      return true;
    }

    try {
      await this.initialize();

      if (!this.isInterstitialReady) {
        await this.preloadInterstitial();
      }

      await AdMob.showInterstitial();
      this.isInterstitialReady = false;
      console.log('✅ Interstitial ad displayed');

      // Automatically preload the next interstitial in the background
      setTimeout(() => this.preloadInterstitial(), 3000);
      return true;
    } catch (error) {
      console.warn('⚠️ Error displaying interstitial ad:', error);
      this.isInterstitialReady = false;
      // Retry preloading for future opportunities
      this.preloadInterstitial();
      return false;
    }
  }

  /**
   * Tracks viewed clippings. Automatically triggers an interstitial ad
   * every 3 clippings.
   */
  onClippingViewed(): void {
    this.clippingViewCounter += 1;
    console.log(`[AdMob] Clippings viewed: ${this.clippingViewCounter}/${this.CLIPPINGS_PER_AD}`);

    if (this.clippingViewCounter % this.CLIPPINGS_PER_AD === 0) {
      console.log(`🎯 Milestone reached: showing ad after ${this.CLIPPINGS_PER_AD} clippings`);
      this.showInterstitial();
    }
  }

  /**
   * Resets the counter if needed.
   */
  resetClippingCounter(): void {
    this.clippingViewCounter = 0;
  }

  /**
   * Displays a sticky banner ad at the bottom.
   * If production ad unit returns no-fill, falls back to Google test banner.
   */
  async showBanner(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await this.initialize();
      const isAndroid = Capacitor.getPlatform() === 'android';
      const prodAdId = isAndroid ? PRODUCTION_AD_UNITS.android.banner : PRODUCTION_AD_UNITS.ios.banner;

      try {
        await AdMob.showBanner({
          adId: prodAdId,
          adSize: BannerAdSize.BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 64, // Keep elevated above bottom navigation bar
          isTesting: false,
        });
        console.log('✅ Production banner ad shown');
      } catch (prodErr) {
        console.warn('⚠️ Production banner failed (likely no fill or verification pending), falling back to test banner:', prodErr);
        const testAdId = isAndroid ? TEST_AD_UNITS.android.banner : TEST_AD_UNITS.ios.banner;
        await AdMob.showBanner({
          adId: testAdId,
          adSize: BannerAdSize.BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 64,
          isTesting: true,
        });
        console.log('✅ Fallback test banner ad shown');
      }
    } catch (error) {
      console.warn('⚠️ Error showing banner ad:', error);
    }
  }

  /**
   * Hides the active banner ad.
   */
  async hideBanner(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await AdMob.hideBanner();
    } catch (error) {
      console.warn('⚠️ Error hiding banner ad:', error);
    }
  }

  /**
   * Displays a rewarded video ad. Invokes `onRewarded` callback upon completion.
   */
  async showRewardAd(onRewarded: () => void): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      onRewarded();
      return true;
    }

    try {
      await this.initialize();
      const isAndroid = Capacitor.getPlatform() === 'android';
      const adId = isAndroid ? TEST_AD_UNITS.android.rewarded : TEST_AD_UNITS.ios.rewarded;

      const options: RewardAdOptions = {
        adId,
        isTesting: true,
      };

      await AdMob.prepareRewardVideoAd(options);
      const reward = await AdMob.showRewardVideoAd();
      if (reward) {
        onRewarded();
        return true;
      }
      return false;
    } catch (error) {
      console.warn('⚠️ Error showing reward ad:', error);
      return false;
    }
  }
}

export const admobService = new AdMobService();
