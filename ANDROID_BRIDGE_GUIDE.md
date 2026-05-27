# Guide pont Android — Vérification de version

Pour que l'app Android expose sa version au site web, ajoute ce code dans ta WebView.

---

## 1. Kotlin — Dans ton Activity ou Fragment WebView

```kotlin
// Configuration de la WebView
val webView: WebView = findViewById(R.id.webview)
webView.settings.javaScriptEnabled = true

// Ajoute cette classe de pont JavaScript
class JuxAndroidBridge(private val context: Context) {
    @JavascriptInterface
    fun getAppVersion(): String {
        // Retourne le versionName du build.gradle
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName
                ?: "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }
    
    // (Garder tes autres méthodes existantes si tu en as)
    // @JavascriptInterface fun downloadSong(payload: String) { ... }
    // etc.
}

// Enregistrer le pont
webView.addJavascriptInterface(JuxAndroidBridge(this), "JuxAndroid")
```

### Version alternative (Java) :

```java
public class JuxAndroidBridge {
    private Context context;
    
    public JuxAndroidBridge(Context context) {
        this.context = context;
    }
    
    @JavascriptInterface
    public String getAppVersion() {
        try {
            return context.getPackageManager()
                .getPackageInfo(context.getPackageName(), 0)
                .versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "1.0.0";
        }
    }
}

// Dans ton activité :
webView.addJavascriptInterface(new JuxAndroidBridge(this), "JuxAndroid");
```

---

## 2. Assure-toi que ta version dans `build.gradle` est correcte

```gradle
// app/build.gradle
android {
    defaultConfig {
        versionName "1.0.1"   // ← c'est cette valeur qui sera retournée
        versionCode 2
    }
}
```

---

## 3. Comment ça fonctionne côté site web

Quand l'utilisateur est sur l'app Android, `getNativeAppVersion()` va :
1. Détecter `window.JuxAndroid?.getAppVersion` → **true**
2. Appeler la fonction → reçoit `"1.0.1"` (ou la version du build.gradle)
3. Comparer avec la version cible `LATEST_APP_VERSION = "1.0.1"`
4. Si différente → bannière de mise à jour

> **Note importante :** La version 1.0.0 n'a PAS ce pont. Donc `getAppVersion()` n'existe pas.  
> → Le site ne reçoit rien → timeout de 5 secondes → l'indicateur se ferme silencieusement.  
> C'est normal : la version 1.0.0 ne peut pas être prévenue via le site.
>
> **Pour que la V1.0.0 soit aussi détectée :**  
> Il faudrait que le code suivant soit appelé DANS la page HTML de la WebView Android (côté natif uniquement) :
> ```javascript
> // Ajouté dans la WebView avant de charger le site
> window.__JUX_APP_VERSION = "1.0.0";
> window.getJuxAppVersion = function() { return "1.0.0"; };
> ```
> Mais ce n'est pas possible rétroactivement — seule la V1.0.1+ aura le pont.

---

## 4. Test

Une fois le pont ajouté et l'app buildée en V1.0.1+ :

```javascript
// Dans la console de la WebView (debug)
window.JuxAndroid.getAppVersion()
// → "1.0.1"
```

Le site détectera automatiquement la version et comparera avec `"1.0.1"`.  
Si la version est différente → la bannière ⚠️ "Mise à jour disponible" s'affichera.