package com.myarchive.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;

import android.content.ActivityNotFoundException;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int REQUEST_RECORD_AUDIO = 4101;
    private static final int REQUEST_SPEECH = 4102;
    private static final int REQUEST_FILE_CHOOSER = 4103;
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingMediaPermission;
    private boolean voiceRequested;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(250, 250, 255));
        getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        webView = new WebView(this);
        webView.setBackgroundColor(android.graphics.Color.rgb(250, 250, 255));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean wantsAudio = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) wantsAudio = true;
                    }
                    if (!wantsAudio) {
                        request.deny();
                        return;
                    }
                    if (android.os.Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                        return;
                    }
                    pendingMediaPermission = request;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_RECORD_AUDIO);
                });
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingMediaPermission == request) pendingMediaPermission = null;
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                Intent chooser = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                chooser.addCategory(Intent.CATEGORY_OPENABLE);
                chooser.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);

                String[] accepted = params.getAcceptTypes();
                java.util.ArrayList<String> mimeTypes = new java.util.ArrayList<>();
                if (accepted != null) {
                    for (String type : accepted) {
                        if (type == null || type.trim().isEmpty()) continue;
                        for (String candidate : type.split(",")) {
                            String value = candidate.trim();
                            if (value.startsWith(".")) {
                                if (value.equalsIgnoreCase(".pdf")) mimeTypes.add("application/pdf");
                                else if (value.equalsIgnoreCase(".doc")) mimeTypes.add("application/msword");
                                else if (value.equalsIgnoreCase(".docx")) mimeTypes.add("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
                            } else {
                                mimeTypes.add(value);
                            }
                        }
                    }
                }
                if (mimeTypes.isEmpty()) mimeTypes.add("*/*");
                chooser.setType(mimeTypes.size() == 1 ? mimeTypes.get(0) : "*/*");
                if (mimeTypes.size() > 1) chooser.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toArray(new String[0]));
                try {
                    startActivityForResult(chooser, REQUEST_FILE_CHOOSER);
                    return true;
                } catch (ActivityNotFoundException error) {
                    filePathCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
            }
        });
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    private void launchSpeechRecognizer() {
        try {
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.SIMPLIFIED_CHINESE.toLanguageTag());
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "请说出你想记录的内容");
            voiceRequested = true;
            startActivityForResult(intent, REQUEST_SPEECH);
        } catch (Exception error) {
            sendVoiceResult("", "当前设备没有可用的语音输入服务");
        }
    }

    private void sendVoiceResult(String text, String error) {
        if (webView == null) return;
        String result = JSONObject.quote(text == null ? "" : text);
        String failure = JSONObject.quote(error == null ? "" : error);
        webView.evaluateJavascript("window.__receiveVoiceResult(" + result + "," + failure + ")", null);
    }

    private String supabaseConfigJson() {
        return "{\"url\":" + JSONObject.quote(BuildConfig.SUPABASE_URL)
                + ",\"key\":" + JSONObject.quote(BuildConfig.SUPABASE_PUBLISHABLE_KEY) + "}";
    }

    private String aiConfigJson() {
        return "{\"deepseek\":" + JSONObject.quote(BuildConfig.DEEPSEEK_API_KEY)
                + ",\"glm\":" + JSONObject.quote(BuildConfig.GLM_API_KEY) + "}";
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_RECORD_AUDIO) return;
        if (pendingMediaPermission != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingMediaPermission.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            } else {
                pendingMediaPermission.deny();
            }
            pendingMediaPermission = null;
            return;
        }
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            launchSpeechRecognizer();
        } else {
            sendVoiceResult("", "需要允许麦克风权限后才能使用语音输入");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_FILE_CHOOSER) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int index = 0; index < count; index++) results[index] = data.getClipData().getItemAt(index).getUri();
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }
        if (requestCode != REQUEST_SPEECH) return;
        voiceRequested = false;
        if (resultCode == RESULT_OK && data != null) {
            ArrayList<String> matches = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            sendVoiceResult(matches != null && !matches.isEmpty() ? matches.get(0) : "", "");
        } else {
            sendVoiceResult("", "没有识别到内容，可以再试一次");
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("window.mobileBack && window.mobileBack()", null);
        } else {
            super.onBackPressed();
        }
    }

    private class AndroidBridge {
        @JavascriptInterface
        public String getSupabaseConfig() {
            return supabaseConfigJson();
        }

        @JavascriptInterface
        public String getAiConfig() {
            return aiConfigJson();
        }

        @JavascriptInterface
        public void startVoiceInput() {
            runOnUiThread(() -> {
                if (android.os.Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_RECORD_AUDIO);
                } else {
                    launchSpeechRecognizer();
                }
            });
        }
    }
}
