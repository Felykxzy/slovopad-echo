import SwiftUI
import WebKit

@main
struct EchoApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.dark)
        }
    }
}

// MARK: - Страница ЭХО внутри приложения

final class EchoStore: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    static let home = URL(string: "https://felykxzy.github.io/slovopad-echo/")!

    @Published var chatOpen = false
    @Published var selected = "chats"
    let web: WKWebView

    // Прячем собственную нижнюю панель и шапку сайта: их заменяет настоящая стеклянная панель iOS.
    // Следим за открытым чатом, чтобы убрать панель и не закрывать поле ввода.
    private static let injected = """
    (function () {
      var css = document.createElement('style');
      css.textContent = 'nav,header{display:none!important} main{padding-bottom:24px!important}';
      document.documentElement.appendChild(css);
      document.addEventListener('DOMContentLoaded', function () {
        var chat = document.getElementById('chat');
        if (!chat) return;
        var post = function () { window.webkit.messageHandlers.echo.postMessage(chat.classList.contains('open')); };
        new MutationObserver(post).observe(chat, { attributes: true, attributeFilter: ['class'] });
        post();
      });
    })();
    """

    override init() {
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.websiteDataStore = .default()
        let ucc = WKUserContentController()
        ucc.addUserScript(WKUserScript(source: EchoStore.injected, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        cfg.userContentController = ucc
        web = WKWebView(frame: .zero, configuration: cfg)
        super.init()
        ucc.add(self, name: "echo")
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.024, green: 0.02, blue: 0.1, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.bounces = false
        web.allowsLinkPreview = false
        web.load(URLRequest(url: EchoStore.home, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 20))
    }

    func select(_ tab: String) {
        selected = tab
        web.evaluateJavaScript("var b=document.querySelector('nav button[data-tab=\(tab)]'); if(b) b.click();", completionHandler: nil)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if let open = message.body as? Bool {
            DispatchQueue.main.async { self.chatOpen = open }
        }
    }

    // Камера и микрофон для звонков — только для нашего сайта
    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host == EchoStore.home.host ? .grant : .deny)
    }

    // Чужие ссылки открываем в Safari
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.targetFrame?.isMainFrame ?? true, let url = navigationAction.request.url,
           let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https", url.host != EchoStore.home.host {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { UIApplication.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let html = """
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#06051a;color:#f4f6ff;font-family:-apple-system,sans-serif;text-align:center">
        <div style="font-size:22px;font-weight:800;letter-spacing:.14em">ЭХО</div>
        <div style="opacity:.7">Нет соединения с интернетом</div>
        <button onclick="location.href='\(EchoStore.home.absoluteString)'" style="font:inherit;font-weight:700;padding:14px 28px;border-radius:22px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#f4f6ff">Повторить</button>
        </body>
        """
        webView.loadHTMLString(html, baseURL: EchoStore.home)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.load(URLRequest(url: EchoStore.home))
    }
}

struct WebContainer: UIViewRepresentable {
    let store: EchoStore
    func makeUIView(context: Context) -> WKWebView { store.web }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

struct NavTab: Identifiable {
    let id: String
    let title: String
    let icon: String
}

// MARK: - Главный экран: страница ЭХО и стеклянная панель снизу

struct RootView: View {
    @StateObject private var store = EchoStore()

    private let tabs: [NavTab] = [
        NavTab(id: "chats", title: "Чаты", icon: "bubble.left.and.bubble.right"),
        NavTab(id: "rooms", title: "Комнаты", icon: "number"),
        NavTab(id: "friends", title: "Друзья", icon: "person.2")
    ]

    var body: some View {
        WebContainer(store: store)
            .ignoresSafeArea()
            .safeAreaInset(edge: .bottom) {
                if !store.chatOpen {
                    glassBar
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.4, dampingFraction: 0.85), value: store.chatOpen)
            .background(Color(red: 0.024, green: 0.02, blue: 0.1).ignoresSafeArea())
    }

    private var glassBar: some View {
        HStack(spacing: 4) {
            ForEach(tabs) { t in
                Button {
                    store.select(t.id)
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: t.icon).font(.system(size: 20, weight: .medium))
                        Text(t.title).font(.caption2.weight(.semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .foregroundStyle(store.selected == t.id ? Color.white : Color.white.opacity(0.6))
                    .background(
                        Capsule()
                            .fill(Color.white.opacity(store.selected == t.id ? 0.18 : 0))
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(6)
        .modifier(GlassCapsule())
        .padding(.horizontal, 16)
        .padding(.bottom, 6)
    }
}

// Настоящее стекло на iOS 26 и новее, на старых версиях — матовая подложка
struct GlassCapsule: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular, in: .capsule)
        } else {
            content
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().stroke(Color.white.opacity(0.2), lineWidth: 1))
        }
    }
}
