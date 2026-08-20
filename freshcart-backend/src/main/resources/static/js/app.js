/* ==========================================================================
   FreshCart - Fresh Vegetables & Fruits Store
   Plain React (via CDN) + Babel-in-browser. No npm install / build required.
   Routing: simple hash-based router (#/, #/login, #/admin, #/cart, #/404)
   Backend: talks to the FreshCart Spring Boot REST API bundled in this same
   jar (same-origin, so relative /api/... paths work with no CORS setup).
   Only the cart-in-progress (before checkout) stays in localStorage; product
   catalog, login/auth, and orders all go through the real backend.
   ========================================================================== */

const { useState, useEffect, useMemo, useCallback } = React;

/* ---------------------------- Constants ---------------------------- */

const LS_KEYS = {
  cart: "fc_cart",
  user: "fc_user",
  cookieConsent: "fc_cookie_consent",
};

/* ---------------------------- API helper ---------------------------- */

// Same-origin: the frontend is served by the same Spring Boot app as the
// API, so relative paths are all we need. If you ever host the frontend
// separately, set this to the backend's full URL instead.
//
// Derived (not hardcoded) so this also works when deployed as a WAR under
// a Tomcat context path (e.g. http://host:8080/freshcart-backend/) instead
// of at the domain root. window.location.pathname is used rather than the
// hash, since hash-based routing (#/, #/login, ...) never changes the
// pathname itself.
const API_BASE = window.location.pathname.replace(/\/[^/]*$/, "");

async function api(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* empty body (e.g. 204 No Content) - fine */
  }

  if (!res.ok) {
    const message = (data && data.message) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.fieldErrors = data && data.fieldErrors;
    throw err;
  }
  return data;
}

/* ---------------------------- Storage helpers ---------------------------- */

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* storage may be unavailable (private mode / quota) - fail silently */
  }
}


/* ---------------------------- Router hook ---------------------------- */

function useHashRoute() {
  const getRoute = () => (window.location.hash || "#/").replace("#", "") || "/";
  const [route, setRoute] = useState(getRoute());
  useEffect(() => {
    const onChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const navigate = (path) => {
    window.location.hash = path;
  };
  return [route, navigate];
}

/* ---------------------------- Small UI bits ---------------------------- */

function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 2200);
    return () => clearTimeout(t);
  }, [message]);
  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="btn btn-outline btn-sm modal-close" onClick={onClose} aria-label="Close">✕</button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function CookieConsent() {
  const [visible, setVisible] = useState(() => !loadLS(LS_KEYS.cookieConsent, false));
  if (!visible) return null;
  const accept = () => {
    saveLS(LS_KEYS.cookieConsent, true);
    setVisible(false);
  };
  return (
    <div className="cookie-banner">
      <p>
        We use cookies and local storage to keep your cart and session working smoothly.
        By continuing to browse FreshCart, you agree to our use of cookies. See our Privacy Policy for details.
      </p>
      <button className="btn btn-primary btn-sm" onClick={accept}>Accept</button>
    </div>
  );
}

/* ---------------------------- Legal / compliance content ---------------------------- */

const LEGAL = {
  privacy: {
    title: "Privacy Policy",
    body: (
      <>
        <p>FreshCart ("we", "us") respects your privacy. This demo application stores your
        cart, session and preferences only in your browser's local storage - no data is sent
        to an external server.</p>
        <ul>
          <li>We do not sell or share personal data with third parties.</li>
          <li>Cookies/local storage are used solely for cart persistence and login session state.</li>
          <li>You can clear stored data anytime by clearing your browser storage.</li>
          <li>For a production deployment, this policy must be updated to reflect real data
            collection, retention, and processing practices in line with applicable laws
            (e.g., GDPR, CCPA, India's DPDP Act).</li>
        </ul>
      </>
    ),
  },
  terms: {
    title: "Terms & Conditions",
    body: (
      <>
        <p>By using FreshCart you agree to purchase fresh produce for personal, non-commercial
        use unless otherwise agreed. Prices are indicative and subject to change without notice.</p>
        <ul>
          <li>Product availability is subject to stock on hand.</li>
          <li>Orders placed through this demo are not fulfilled - this is a sample application.</li>
          <li>Misuse of the admin panel or attempts to bypass authentication are prohibited.</li>
        </ul>
      </>
    ),
  },
  refund: {
    title: "Refund & Returns Policy",
    body: (
      <>
        <p>Freshness guaranteed. If produce arrives damaged or below quality expectations,
        customers may request a replacement or refund within 24 hours of delivery, subject
        to review.</p>
        <p>This is placeholder policy text intended for a real backend/order-management
        integration.</p>
      </>
    ),
  },
  accessibility: {
    title: "Accessibility Statement",
    body: (
      <>
        <p>FreshCart aims to be usable by everyone. The interface uses semantic HTML,
        labelled form fields, sufficient color contrast, and keyboard-operable controls.
        If you encounter an accessibility barrier, please contact us so we can address it.</p>
      </>
    ),
  },
};

/* ---------------------------- Navbar ---------------------------- */

function Navbar({ route, navigate, user, cartCount, onLogout }) {
  const isActive = (path) => route === path;
  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <a href="#/" className="brand" aria-label="FreshCart home">
          🥬 FreshCart
        </a>
        <div className="nav-links">
          <a href="#/" className={"nav-link" + (isActive("/") ? " active" : "")}>Home</a>
          <a href="#/cart" className={"nav-link" + (isActive("/cart") ? " active" : "")}>
            Cart {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </a>
          {user && user.role === "admin" && (
            <a href="#/admin" className={"nav-link" + (isActive("/admin") ? " active" : "")}>
              Admin Dashboard
            </a>
          )}
          {!user && (
            <a href="#/login" className={"nav-link" + (isActive("/login") ? " active" : "")}>
              Login
            </a>
          )}
          {user && (
            <button className="nav-link" onClick={onLogout}>
              Logout ({user.name}{user.role === "admin" ? " · Admin" : ""})
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ---------------------------- Home / Product listing ---------------------------- */

function ProductCard({ product, onAdd }) {
  const [qty, setQty] = useState(1);
  const outOfStock = product.stock <= 0;
  return (
    <div className="card">
      <div className="card-media" aria-hidden="true">{product.emoji}</div>
      <div className="card-body">
        <div className="card-cat">{product.category}</div>
        <div className="card-title">{product.name}</div>
        <div className="card-stock">{outOfStock ? "Out of stock" : `${product.stock} ${product.unit} available`}</div>
        <div className="card-price">₹{product.price} / {product.unit}</div>
        <div className="card-actions">
          <input
            type="number"
            min="1"
            max={product.stock || 1}
            className="qty-input"
            value={qty}
            aria-label={`Quantity for ${product.name}`}
            disabled={outOfStock}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={outOfStock}
            onClick={() => onAdd(product, qty)}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

function Home({ products, onAdd }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = category === "All" || p.category === category;
      const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [products, query, category]);

  return (
    <>
      <div className="hero">
        <div className="container">
          <h1>Farm-Fresh Vegetables &amp; Fruits, Delivered</h1>
          <p>Hand-picked produce sourced directly from local farms - fresh, healthy, affordable.</p>
        </div>
      </div>

      <div className="container">
        <div className="toolbar">
          <input
            type="search"
            className="search-box"
            placeholder="Search for tomatoes, apples, spinach..."
            value={query}
            aria-label="Search products"
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="filter-group" role="group" aria-label="Filter by category">
            {["All", "Vegetables", "Fruits"].map((c) => (
              <button
                key={c}
                className={"chip" + (category === c ? " active" : "")}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">🔍</div>
            <p>No products match your search.</p>
          </div>
        ) : (
          <div className="grid">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} onAdd={onAdd} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------------------- Login ---------------------------- */

function Login({ navigate, onLogin, showToast }) {
  const [role, setRole] = useState("customer");
  const [mode, setMode] = useState("login"); // "login" | "register" (customers only)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const afterAuth = (data) => {
    onLogin({ token: data.token, name: data.name, email: data.email, role: data.role.toLowerCase() });
    showToast(`Welcome, ${data.name}!`);
    navigate(data.role === "ADMIN" ? "/admin" : "/");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "register") {
        const data = await api("/api/auth/register", {
          method: "POST",
          body: { name, email, password },
        });
        afterAuth(data);
        return;
      }

      const data = await api("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });

      if (role === "admin" && data.role !== "ADMIN") {
        setError("This account does not have admin access.");
        return;
      }
      afterAuth(data);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="auth-wrap">
        <h2>{mode === "register" ? "Create your account" : "Welcome back"}</h2>

        {mode === "login" && (
          <div className="role-toggle" role="tablist" aria-label="Login as">
            <button
              type="button"
              className={role === "customer" ? "active" : ""}
              onClick={() => { setRole("customer"); setError(""); }}
              role="tab"
              aria-selected={role === "customer"}
            >
              Customer
            </button>
            <button
              type="button"
              className={role === "admin" ? "active" : ""}
              onClick={() => { setRole("admin"); setError(""); }}
              role="tab"
              aria-selected={role === "admin"}
            >
              Admin
            </button>
          </div>
        )}

        {error && <div className="form-error" role="alert">{error}</div>}

        <form onSubmit={submit} noValidate>
          {mode === "register" && (
            <div className="field">
              <label htmlFor="reg-name">Full name</label>
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting
              ? "Please wait..."
              : mode === "register"
                ? "Create account"
                : role === "admin" ? "Login as Admin" : "Login"}
          </button>
        </form>

        {role === "customer" && (
          <p className="hint">
            {mode === "register" ? (
              <>Already have an account?{" "}
                <button type="button" className="linklike" onClick={() => { setMode("login"); setError(""); }}>
                  Log in
                </button>
              </>
            ) : (
              <>New to FreshCart?{" "}
                <button type="button" className="linklike" onClick={() => { setMode("register"); setError(""); }}>
                  Create an account
                </button>
              </>
            )}
          </p>
        )}

        {role === "admin" && mode === "login" && (
          <p className="hint">
            Default seeded admin login — email: <strong>admin@freshcart.com</strong>, password: <strong>Admin@123</strong>.
            Change these via the <code>ADMIN_EMAIL</code> / <code>ADMIN_PASSWORD</code> environment variables in production.
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Admin Dashboard ---------------------------- */

function emptyForm() {
  return { id: "", name: "", category: "Vegetables", price: "", unit: "kg", stock: "", emoji: "🥕" };
}

function AdminDashboard({ products, refreshProducts, token, showToast }) {
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [stats, setStats] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadStats = useCallback(() => {
    api("/api/admin/stats", { token })
      .then(setStats)
      .catch(() => { /* stat cards just stay blank on failure */ });
  }, [token]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price || !form.stock) return;

    const payload = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
      unit: form.unit,
      stock: Number(form.stock),
      emoji: form.emoji,
    };

    setSaving(true);
    try {
      if (editingId) {
        await api(`/api/products/${editingId}`, { method: "PUT", body: payload, token });
        showToast("Product updated.");
      } else {
        await api("/api/products", { method: "POST", body: payload, token });
        showToast("Product added.");
      }
      resetForm();
      await refreshProducts();
      loadStats();
    } catch (err) {
      showToast(err.message || "Could not save product.");
    } finally {
      setSaving(false);
    }
  };

  const editProduct = (p) => {
    setForm({ ...p, price: String(p.price), stock: String(p.stock) });
    setEditingId(p.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await api(`/api/products/${id}`, { method: "DELETE", token });
      showToast("Product deleted.");
      if (editingId === id) resetForm();
      await refreshProducts();
      loadStats();
    } catch (err) {
      showToast(err.message || "Could not delete product.");
    }
  };

  return (
    <div className="container">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="num">{stats ? stats.totalProducts : products.length}</div>
          <div className="label">Total Products</div>
        </div>
        <div className="stat-card">
          <div className="num">₹{(stats ? stats.totalStockValue : 0).toLocaleString("en-IN")}</div>
          <div className="label">Inventory Value</div>
        </div>
        <div className="stat-card">
          <div className="num">{stats ? stats.lowStockCount : 0}</div>
          <div className="label">Low Stock Items (&le;20)</div>
        </div>
        <div className="stat-card">
          <div className="num">{stats ? stats.totalOrders : 0}</div>
          <div className="label">Total Orders</div>
        </div>
      </div>

      <div className="admin-panel">
        <h3>{editingId ? "Edit Product" : "Add New Product"}</h3>
        <form onSubmit={submit}>
          <div className="admin-form-grid">
            <div className="field">
              <label htmlFor="f-name">Name</label>
              <input id="f-name" value={form.name} required
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="f-emoji">Icon (emoji)</label>
              <input id="f-emoji" value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="f-cat">Category</label>
              <select id="f-cat" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--gray-300)" }}>
                <option>Vegetables</option>
                <option>Fruits</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-price">Price (₹)</label>
              <input id="f-price" type="number" min="0" value={form.price} required
                onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="f-unit">Unit</label>
              <input id="f-unit" value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="f-stock">Stock</label>
              <input id="f-stock" type="number" min="0" value={form.stock} required
                onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Product"}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
            )}
          </div>
        </form>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td style={{ fontSize: "22px" }}>{p.emoji}</td>
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td>₹{p.price} / {p.unit}</td>
                <td>{p.stock}</td>
                <td>
                  <button className="btn btn-outline btn-sm" onClick={() => editProduct(p)} style={{ marginRight: "6px" }}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------- Cart ---------------------------- */

function Cart({ cart, setCart, navigate, showToast, user, refreshProducts }) {
  const [placing, setPlacing] = useState(false);

  const updateQty = (id, qty) => {
    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, qty: Math.max(1, qty) } : item)));
  };
  const removeItem = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const deliveryFee = total > 0 && total < 300 ? 40 : 0;

  const checkout = async () => {
    if (!user) {
      showToast("Please log in to check out.");
      navigate("/login");
      return;
    }
    setPlacing(true);
    try {
      const order = await api("/api/orders", {
        method: "POST",
        token: user.token,
        body: { items: cart.map((item) => ({ productId: item.id, quantity: item.qty })) },
      });
      showToast(`✅ Order #${order.id} placed! Total ₹${order.total}`);
      setCart([]);
      await refreshProducts();
      navigate("/");
    } catch (err) {
      showToast(err.message || "Could not place order.");
    } finally {
      setPlacing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="emoji">🛒</div>
          <p>Your cart is empty.</p>
          <a className="btn btn-primary" href="#/">Start Shopping</a>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Your Cart</h1>
      {cart.map((item) => (
        <div className="cart-row" key={item.id}>
          <div className="emoji">{item.emoji}</div>
          <div className="name">{item.name}<div style={{ fontSize: "12px", color: "var(--gray-600)" }}>₹{item.price} / {item.unit}</div></div>
          <input
            type="number"
            min="1"
            className="qty-input"
            value={item.qty}
            aria-label={`Quantity for ${item.name}`}
            onChange={(e) => updateQty(item.id, Number(e.target.value) || 1)}
          />
          <div style={{ fontWeight: 700, minWidth: "70px", textAlign: "right" }}>₹{item.price * item.qty}</div>
          <button className="btn btn-danger btn-sm" onClick={() => removeItem(item.id)}>Remove</button>
        </div>
      ))}

      <div className="cart-summary">
        <div className="summary-line"><span>Subtotal</span><span>₹{total}</span></div>
        <div className="summary-line"><span>Delivery</span><span>{deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}</span></div>
        <div className="summary-line summary-total"><span>Total</span><span>₹{total + deliveryFee}</span></div>
        <button className="btn btn-primary btn-block" style={{ marginTop: "14px" }} onClick={checkout} disabled={placing}>
          {placing ? "Placing order..." : "Checkout"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- 404 / Not found ---------------------------- */

function NotFound() {
  return (
    <div className="error-page">
      <div className="error-box">
        <div className="error-emoji">🍉🥕🍎</div>
        <h1>404</h1>
        <h2>Oops! This page went bad, just like an old banana.</h2>
        <p>The page you're looking for doesn't exist or may have been moved.</p>
        <a className="btn btn-primary" href="#/">Back to FreshCart Home</a>
      </div>
    </div>
  );
}

/* ---------------------------- Access denied ---------------------------- */

function AccessDenied({ navigate }) {
  return (
    <div className="error-page">
      <div className="error-box">
        <div className="error-emoji">🔒</div>
        <h1 style={{ fontSize: "40px" }}>Access Denied</h1>
        <h2>You need admin privileges to view this page.</h2>
        <p>Please log in with an admin account to continue.</p>
        <button className="btn btn-primary" onClick={() => navigate("/login")}>Go to Login</button>
      </div>
    </div>
  );
}

/* ---------------------------- Footer ---------------------------- */

function Footer({ openModal }) {
  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div>
            <h4>FreshCart</h4>
            <p style={{ color: "#cfe8d8", fontSize: "13px" }}>
              Fresh vegetables and fruits, sourced responsibly and delivered with care.
            </p>
          </div>
          <div>
            <h4>Legal &amp; Compliance</h4>
            <button className="linklike" onClick={() => openModal("privacy")}>Privacy Policy</button>
            <button className="linklike" onClick={() => openModal("terms")}>Terms &amp; Conditions</button>
            <button className="linklike" onClick={() => openModal("refund")}>Refund &amp; Returns Policy</button>
            <button className="linklike" onClick={() => openModal("accessibility")}>Accessibility Statement</button>
          </div>
          <div>
            <h4>Company</h4>
            <a href="#/">Home</a>
            <a href="#/cart">Cart</a>
            <a href="#/login">Login</a>
          </div>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} FreshCart. All rights reserved. This is a demo application for educational purposes.
        </div>
      </div>
    </footer>
  );
}

/* ---------------------------- Root App ---------------------------- */

function App() {
  const [route, navigate] = useHashRoute();
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [cart, setCart] = useState(() => loadLS(LS_KEYS.cart, []));
  const [user, setUser] = useState(() => loadLS(LS_KEYS.user, null));
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);

  const showToast = useCallback((msg) => setToast(msg), []);

  const refreshProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const data = await api("/api/products");
      setProducts(data);
      setProductsError("");
    } catch (err) {
      setProductsError(err.message || "Could not load products from the server.");
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => { refreshProducts(); }, [refreshProducts]);
  useEffect(() => saveLS(LS_KEYS.cart, cart), [cart]);
  useEffect(() => saveLS(LS_KEYS.user, user), [user]);

  const addToCart = useCallback((product, qty) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + qty } : i));
      }
      return [...prev, { ...product, qty }];
    });
    showToast(`${product.name} added to cart.`);
  }, [showToast]);

  const handleLogout = () => {
    setUser(null);
    showToast("Logged out.");
    navigate("/");
  };

  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  let page;
  if (route === "/" ) {
    page = productsLoading
      ? <div className="container"><p style={{ padding: "40px 0" }}>Loading products…</p></div>
      : productsError
        ? <div className="container"><div className="empty-state"><p>{productsError}</p>
            <button className="btn btn-primary" onClick={refreshProducts}>Retry</button></div></div>
        : <Home products={products} onAdd={addToCart} />;
  } else if (route === "/login") {
    page = <Login navigate={navigate} onLogin={setUser} showToast={showToast} />;
  } else if (route === "/admin") {
    page = user && user.role === "admin"
      ? <AdminDashboard products={products} refreshProducts={refreshProducts} token={user.token} showToast={showToast} />
      : <AccessDenied navigate={navigate} />;
  } else if (route === "/cart") {
    page = <Cart cart={cart} setCart={setCart} navigate={navigate} showToast={showToast} user={user} refreshProducts={refreshProducts} />;
  } else {
    page = <NotFound />;
  }

  return (
    <>
      <div className="top-bar">🚚 Free delivery on orders above ₹300 &nbsp;|&nbsp; Farm-fresh produce, every day</div>
      <Navbar route={route} navigate={navigate} user={user} cartCount={cartCount} onLogout={handleLogout} />
      {page}
      <Footer openModal={setModal} />
      <CookieConsent />
      <Toast message={toast} onClose={() => setToast("")} />
      {modal && (
        <Modal title={LEGAL[modal].title} onClose={() => setModal(null)}>
          {LEGAL[modal].body}
        </Modal>
      )}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
