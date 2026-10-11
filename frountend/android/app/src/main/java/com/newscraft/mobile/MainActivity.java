package com.newscraft.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TargetSharePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

