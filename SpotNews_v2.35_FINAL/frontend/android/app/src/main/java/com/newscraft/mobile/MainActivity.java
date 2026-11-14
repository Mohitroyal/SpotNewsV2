package com.newscraft.mobile;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    private boolean isClientConfigured = false;
    private String pendingNotificationClipId = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TargetSharePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        handleNotificationIntent(getIntent());
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        android.os.Bundle extras = intent.getExtras();
        String clipId = null;
        String url = null;

        if (extras != null) {
            clipId = extras.getString("clipId");
            if (clipId == null || clipId.isEmpty()) clipId = extras.getString("clipping_id");
            if (clipId == null || clipId.isEmpty()) clipId = extras.getString("clippingId");
            if (clipId == null || clipId.isEmpty()) clipId = extras.getString("id");

            url = extras.getString("url");
            if (url == null || url.isEmpty()) url = extras.getString("link");
            if (url == null || url.isEmpty()) url = extras.getString("path");
        }

        Uri dataUri = intent.getData();
        if (dataUri != null) {
            String uriStr = dataUri.toString();
            if (url == null || url.isEmpty()) url = uriStr;
            String qClip = dataUri.getQueryParameter("clipId");
            if (qClip == null || qClip.isEmpty()) qClip = dataUri.getQueryParameter("id");
            if (qClip != null && !qClip.isEmpty()) clipId = qClip;
        }

        if ((clipId == null || clipId.isEmpty()) && url != null && !url.isEmpty()) {
            java.util.regex.Pattern p = java.util.regex.Pattern.compile("(?:clipId|id|n)=([^&#]+)|/(?:n|story|preview|clip)/([^/?#]+)");
            java.util.regex.Matcher m = p.matcher(url);
            if (m.find()) {
                clipId = m.group(1) != null ? m.group(1) : m.group(2);
            }
        }

        if (clipId != null && !clipId.trim().isEmpty()) {
            final String targetClipId = clipId.trim();
            pendingNotificationClipId = targetClipId;
            if (extras != null) {
                extras.remove("clipId");
                extras.remove("clipping_id");
                extras.remove("clippingId");
                extras.remove("id");
                extras.remove("url");
            }
            if (this.bridge != null && this.bridge.getWebView() != null) {
                final Runnable evalRunnable = new Runnable() {
                    @Override
                    public void run() {
                        if (bridge == null || bridge.getWebView() == null) return;
                        String js = "try { " +
                            "localStorage.setItem('spotnews_pending_clip_id', '" + targetClipId + "'); " +
                            "sessionStorage.setItem('spotnews_pending_clip_id', '" + targetClipId + "'); " +
                            "window.dispatchEvent(new CustomEvent('spotnews-open-clipping', { detail: { clipId: '" + targetClipId + "' } })); " +
                            "} catch(e) {}";
                        bridge.getWebView().evaluateJavascript(js, null);
                    }
                };
                this.bridge.getWebView().post(evalRunnable);
                this.bridge.getWebView().postDelayed(evalRunnable, 500);
                this.bridge.getWebView().postDelayed(evalRunnable, 1200);
            }
        }
    }

    @Override
    public void onStart() {
        super.onStart();

        if (this.bridge != null && this.bridge.getWebView() != null && !isClientConfigured) {
            WebView webView = this.bridge.getWebView();
            android.webkit.WebSettings settings = webView.getSettings();
            settings.setJavaScriptCanOpenWindowsAutomatically(true);
            settings.setDomStorageEnabled(true);

            webView.setWebViewClient(new BridgeWebViewClient(this.bridge) {
                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    if (pendingNotificationClipId != null && view != null) {
                        final String target = pendingNotificationClipId;
                        pendingNotificationClipId = null;
                        String js = "try { " +
                            "localStorage.setItem('spotnews_pending_clip_id', '" + target + "'); " +
                            "sessionStorage.setItem('spotnews_pending_clip_id', '" + target + "'); " +
                            "window.dispatchEvent(new CustomEvent('spotnews-open-clipping', { detail: { clipId: '" + target + "' } })); " +
                            "} catch(e) {}";
                        view.evaluateJavascript(js, null);
                    }
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    if (request != null && request.getUrl() != null) {
                        if (handleExternalSchemes(request.getUrl())) {
                            return true;
                        }
                    }
                    return super.shouldOverrideUrlLoading(view, request);
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    if (url != null) {
                        if (handleExternalSchemes(Uri.parse(url))) {
                            return true;
                        }
                    }
                    return super.shouldOverrideUrlLoading(view, url);
                }

                private boolean handleExternalSchemes(Uri uri) {
                    if (uri == null) return false;
                    String scheme = uri.getScheme();
                    String urlString = uri.toString();

                    if (scheme != null && (
                            scheme.equalsIgnoreCase("upi") ||
                            scheme.equalsIgnoreCase("tez") ||
                            scheme.equalsIgnoreCase("phonepe") ||
                            scheme.equalsIgnoreCase("paytmmp") ||
                            scheme.equalsIgnoreCase("whatsapp") ||
                            urlString.startsWith("intent://")
                    )) {
                        try {
                            Intent intent;
                            if (urlString.startsWith("intent://")) {
                                intent = Intent.parseUri(urlString, Intent.URI_INTENT_SCHEME);
                            } else {
                                intent = new Intent(Intent.ACTION_VIEW, uri);
                            }

                            if (intent != null) {
                                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                if (intent.resolveActivity(getPackageManager()) != null) {
                                    startActivity(intent);
                                    return true;
                                } else {
                                    Intent chooser = Intent.createChooser(intent, "Pay via");
                                    chooser.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    startActivity(chooser);
                                    return true;
                                }
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                        return true;
                    }

                    return false;
                }
            });
            isClientConfigured = true;
        }
    }
}
