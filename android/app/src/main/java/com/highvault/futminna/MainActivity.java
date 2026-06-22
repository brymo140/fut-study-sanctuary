package com.highvault.futminna;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIncomingFile(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIncomingFile(intent);
    }

    private void handleIncomingFile(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();
        if (!Intent.ACTION_VIEW.equals(action) || type == null || !type.equals("application/pdf")) return;

        Uri uri = intent.getData();
        if (uri == null) return;

        try {
            String fileName = queryFileName(uri);
            File outFile = new File(getCacheDir(), "external-open/" + fileName);
            outFile.getParentFile().mkdirs();

            InputStream in = getContentResolver().openInputStream(uri);
            FileOutputStream out = new FileOutputStream(outFile);
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            in.close();
            out.close();

            String jsPath = outFile.getAbsolutePath();
            String escaped = jsPath.replace("\\", "\\\\").replace("'", "\\'");
            String js = "window.dispatchEvent(new CustomEvent('hv:openExternalPdf', { detail: { path: '" + escaped + "' } }));";

            getBridge().getWebView().post(() ->
                getBridge().getWebView().evaluateJavascript(js, null)
            );
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private String queryFileName(Uri uri) {
        String name = "opened.pdf";
        Cursor cursor = getContentResolver().query(uri, null, null, null, null);
        if (cursor != null) {
            try {
                if (cursor.moveToFirst()) {
                    int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (idx >= 0) {
                        String result = cursor.getString(idx);
                        if (result != null) name = result;
                    }
                }
            } finally {
                cursor.close();
            }
        }
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
