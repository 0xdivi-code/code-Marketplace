import { Routes, Route, Navigate } from "react-router-dom";
import { SiteLayout } from "@/components/site/site-layout";
import { CatalogBoot } from "@/components/site/catalog-boot";
import { useCatalog } from "@/lib/catalog-store";
import HomePage from "@/pages/home";
import BrowsePage from "@/pages/browse";
import CategoryPage from "@/pages/category";
import ProductPage from "@/pages/product";
import CollectionsPage from "@/pages/collections";
import CollectionPage from "@/pages/collection";
import FreePage from "@/pages/free";
import CartPage from "@/pages/cart";
import CheckoutPage from "@/pages/checkout";
import OrderConfirmationPage from "@/pages/order-confirmation";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import ForgotPasswordPage from "@/pages/auth/forgot";
import ResetPasswordPage from "@/pages/auth/reset";
import VerifyEmailPage from "@/pages/auth/verify-email";
import AccountLayout from "@/pages/account/account-layout";
import DashboardPage from "@/pages/account/dashboard";
import OrdersPage from "@/pages/account/orders";
import LibraryPage from "@/pages/account/library";
import WishlistPage from "@/pages/account/wishlist";
import SettingsPage from "@/pages/account/settings";
import AboutPage from "@/pages/about";
import ContactPage from "@/pages/contact";
import BlogPage from "@/pages/blog";
import BlogPostPage from "@/pages/blog-post";
import LegalPage from "@/pages/legal/legal";
import ChangelogPage from "@/pages/changelog";
import NotFoundPage from "@/pages/not-found";

import { AdminLayout } from "@/admin/admin-layout";
import AdminDashboard from "@/admin/dashboard";
import AdminProducts from "@/admin/products";
import AdminProductEditor from "@/admin/product-editor";
import AdminCategories from "@/admin/categories";
import AdminOrders from "@/admin/orders";
import AdminOrderDetail from "@/admin/order-detail";
import AdminCustomers from "@/admin/customers";
import AdminPayments from "@/admin/payments";
import AdminContent from "@/admin/content";
import AdminBanners from "@/admin/banners";
import AdminPromotions from "@/admin/promotions";
import AdminSettings from "@/admin/settings";
import AdminActivity from "@/admin/activity";

export default function App() {
  /** Subscribe at the root so every route re-renders when the catalogue
   *  hydrates from the API or the admin panel changes something. */
  useCatalog();

  return (
    <CatalogBoot>
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/category/:slug" element={<CategoryPage />} />
        <Route path="/item/:slug" element={<ProductPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/collection/:slug" element={<CollectionPage />} />
        <Route path="/free" element={<FreePage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/order/:id" element={<OrderConfirmationPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="/page/:slug" element={<LegalPage />} />

        <Route path="/account" element={<AccountLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* checkout runs standalone: it ships its own minimal header */}
      <Route path="/checkout" element={<CheckoutPage />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="products/new" element={<AdminProductEditor />} />
        <Route path="products/:slug" element={<AdminProductEditor />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<AdminOrderDetail />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="banners" element={<AdminBanners />} />
        <Route path="promotions" element={<AdminPromotions />} />
        <Route path="content" element={<AdminContent />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="activity" element={<AdminActivity />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
    </CatalogBoot>
  );
}
