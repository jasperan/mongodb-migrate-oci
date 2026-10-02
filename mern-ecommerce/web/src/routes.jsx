import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { RequireAuth } from './components/auth/RequireAuth'
import { LoadingBlock } from './components/ui/Display'
import Home from './pages/Home'
import RouteError from './pages/RouteError'

const Shop = lazy(() => import('./pages/Shop'))
const Product = lazy(() => import('./pages/Product'))
const Brands = lazy(() => import('./pages/Brands'))
const Sell = lazy(() => import('./pages/Sell'))
const Contact = lazy(() => import('./pages/Contact'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const NotFound = lazy(() => import('./pages/NotFound'))

const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const AuthSuccess = lazy(() => import('./pages/auth/AuthSuccess'))
const MerchantSignup = lazy(() => import('./pages/auth/MerchantSignup'))

const DashboardLayout = lazy(() => import('./pages/dashboard/DashboardLayout'))
const Overview = lazy(() => import('./pages/dashboard/Overview'))
const Security = lazy(() => import('./pages/dashboard/Security'))
const Addresses = lazy(() => import('./pages/dashboard/Addresses'))
const Orders = lazy(() => import('./pages/dashboard/Orders'))
const Wishlist = lazy(() => import('./pages/dashboard/Wishlist'))
const Products = lazy(() => import('./pages/dashboard/Products'))
const Categories = lazy(() => import('./pages/dashboard/Categories'))
const DashboardBrands = lazy(() => import('./pages/dashboard/Brands'))
const Users = lazy(() => import('./pages/dashboard/Users'))
const Merchants = lazy(() => import('./pages/dashboard/Merchants'))
const Reviews = lazy(() => import('./pages/dashboard/Reviews'))

const Support = lazy(() => import('./pages/support/Support'))
const LlmChat = lazy(() => import('./pages/support/LlmChat'))
const AdminDb = lazy(() => import('./pages/support/AdminDb'))

const withSuspense = (element) => <Suspense fallback={<LoadingBlock />}>{element}</Suspense>

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: 'shop', element: withSuspense(<Shop />) },
      { path: 'product/:slug', element: withSuspense(<Product />) },
      { path: 'brands', element: withSuspense(<Brands />) },
      { path: 'sell', element: withSuspense(<Sell />) },
      { path: 'contact', element: withSuspense(<Contact />) },
      { path: 'cart', element: withSuspense(<Cart />) },
      { path: 'checkout', element: withSuspense(<Checkout />) },
      { path: 'order/success/:id', element: withSuspense(<OrderSuccess />) },
      { path: 'order/:id', element: withSuspense(<OrderDetail />) },
      { path: 'login', element: withSuspense(<Login />) },
      { path: 'register', element: withSuspense(<Register />) },
      { path: 'forgot-password', element: withSuspense(<ForgotPassword />) },
      { path: 'reset-password/:token', element: withSuspense(<ResetPassword />) },
      { path: 'auth/success', element: withSuspense(<AuthSuccess />) },
      { path: 'merchant-signup/:token', element: withSuspense(<MerchantSignup />) },
      { path: 'support/llm-chat', element: withSuspense(<LlmChat />) },
      { path: 'support/admin-db', element: withSuspense(<AdminDb />) },
      { path: '404', element: withSuspense(<NotFound />) },
      {
        element: <RequireAuth />,
        children: [
          { path: 'support', element: withSuspense(<Support />) },
          {
            path: 'dashboard',
            element: withSuspense(<DashboardLayout />),
            children: [
              { index: true, element: withSuspense(<Overview />) },
              { path: 'security', element: withSuspense(<Security />) },
              { path: 'address', element: withSuspense(<Addresses />) },
              { path: 'orders', element: withSuspense(<Orders />) },
              { path: 'wishlist', element: withSuspense(<Wishlist />) },
              { path: 'product', element: withSuspense(<RequireAuth roles={['ROLE ADMIN', 'ROLE MERCHANT']} />),
                children: [{ index: true, element: withSuspense(<Products />) }] },
              { path: 'category', element: withSuspense(<RequireAuth roles={['ROLE ADMIN']} />),
                children: [{ index: true, element: withSuspense(<Categories />) }] },
              { path: 'brand', element: withSuspense(<RequireAuth roles={['ROLE ADMIN', 'ROLE MERCHANT']} />),
                children: [{ index: true, element: withSuspense(<DashboardBrands />) }] },
              { path: 'users', element: withSuspense(<RequireAuth roles={['ROLE ADMIN']} />),
                children: [{ index: true, element: withSuspense(<Users />) }] },
              { path: 'merchant', element: withSuspense(<RequireAuth roles={['ROLE ADMIN']} />),
                children: [{ index: true, element: withSuspense(<Merchants />) }] },
              { path: 'review', element: withSuspense(<RequireAuth roles={['ROLE ADMIN']} />),
                children: [{ index: true, element: withSuspense(<Reviews />) }] }
            ]
          }
        ]
      },
      { path: '*', element: withSuspense(<NotFound />) }
    ]
  }
])
