package com.newscraft.mobile;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/**
 * Shares an image + caption directly to one app (WhatsApp, Instagram, Facebook, X) instead of the generic share sheet.
 * JS: TargetShare.share({ package: "com.whatsapp", fileUri, text, mime: "image/jpeg" })
 * Rejects with "not_installed" if that app is missing → the JS side then opens the normal share sheet.
 */
@CapacitorPlugin(name = "TargetShare")
public class TargetSharePlugin extends Plugin {

    @PluginMethod
    public void share(PluginCall call) {
        String pkg = call.getString("package");
        if (pkg == null) {
            call.reject("package required");
            return;
        }

        String fileUri = call.getString("fileUri");
        if (fileUri == null) {
            call.reject("fileUri required");
            return;
        }

        String text = call.getString("text", "");
        String mime = call.getString("mime", "image/*");

        Uri parsed = Uri.parse(fileUri);
        String path = parsed.getPath();
        File file = (path != null) ? new File(path) : new File(fileUri);
        if (!file.exists() && fileUri.startsWith("file://")) {
            file = new File(fileUri.substring(7));
        }

        try {
            Uri contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mime);
            intent.putExtra(Intent.EXTRA_STREAM, contentUri);
            if (text != null && !text.isEmpty()) {
                intent.putExtra(Intent.EXTRA_TEXT, text);
            }
            intent.setPackage(pkg);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (ActivityNotFoundException e) {
            call.reject("not_installed");
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "share_failed");
        }
    }
}
