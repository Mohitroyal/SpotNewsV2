package com.newscraft.mobile;

import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onStart() {
        super.onStart();

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            android.webkit.WebSettings settings = webView.getSettings();
            settings.setUserAgentString("Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36");
            settings.setJavaScriptCanOpenWindowsAutomatically(true);
            settings.setDomStorageEnabled(true);

            webView.setWebViewClient(new BridgeWebViewClient(this.bridge) {
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
        }
    }
}
