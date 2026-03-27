import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      nav: { home: 'Home', pricing: 'Pricing', login: 'Log In', signup: 'Sign Up', dashboard: 'Dashboard', logout: 'Log Out' },
      hero: {
        badge: 'Production-Ready on Hedera Mainnet',
        title1: 'The Intelligent Notary',
        title2: 'Platform with',
        title3: 'Unbreakable Trust',
        subtitle: 'NotaryChain fuses AI document intelligence, biometric verification, and blockchain-sealed integrity into one enterprise-grade platform.',
        cta_start: 'Get Started Free',
        cta_demo: 'Live Demo',
      },
      trust: { soc2: 'SOC2 Compliant', hedera: 'Hedera Mainnet', ai: 'AI-Powered', biometric: 'Biometric ID' },
      auth: {
        sign_in: 'Sign In',
        sign_up: 'Sign Up',
        email: 'Email Address',
        password: 'Password',
        confirm_password: 'Confirm Password',
        full_name: 'Full Name',
        forgot: 'Forgot password?',
        no_account: "Don't have an account?",
        has_account: 'Already have an account?',
        or_continue: 'Or continue with',
        welcome_back: 'Welcome Back',
        create_account: 'Create Your Account',
      },
      dashboard: {
        title: 'Dashboard',
        welcome: 'Welcome back',
        documents: 'Documents',
        pending: 'Pending',
        completed: 'Completed',
        recent: 'Recent Activity',
      },
      common: { loading: 'Loading...', save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', search: 'Search', back: 'Back' },
    },
  },
  es: {
    translation: {
      nav: { home: 'Inicio', pricing: 'Precios', login: 'Iniciar Sesion', signup: 'Registrarse', dashboard: 'Panel', logout: 'Cerrar Sesion' },
      hero: {
        badge: 'Produccion lista en Hedera Mainnet',
        title1: 'La Plataforma Notarial',
        title2: 'Inteligente con',
        title3: 'Confianza Inquebrantable',
        subtitle: 'NotaryChain fusiona inteligencia documental IA, verificacion biometrica e integridad sellada en blockchain en una plataforma empresarial.',
        cta_start: 'Comenzar Gratis',
        cta_demo: 'Demo en Vivo',
      },
      trust: { soc2: 'Cumplimiento SOC2', hedera: 'Hedera Mainnet', ai: 'Potenciado por IA', biometric: 'ID Biometrico' },
      auth: {
        sign_in: 'Iniciar Sesion',
        sign_up: 'Registrarse',
        email: 'Correo Electronico',
        password: 'Contrasena',
        confirm_password: 'Confirmar Contrasena',
        full_name: 'Nombre Completo',
        forgot: 'Olvidaste la contrasena?',
        no_account: 'No tienes una cuenta?',
        has_account: 'Ya tienes una cuenta?',
        or_continue: 'O continuar con',
        welcome_back: 'Bienvenido de Nuevo',
        create_account: 'Crea Tu Cuenta',
      },
      dashboard: {
        title: 'Panel',
        welcome: 'Bienvenido de nuevo',
        documents: 'Documentos',
        pending: 'Pendientes',
        completed: 'Completados',
        recent: 'Actividad Reciente',
      },
      common: { loading: 'Cargando...', save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar', search: 'Buscar', back: 'Volver' },
    },
  },
  fr: {
    translation: {
      nav: { home: 'Accueil', pricing: 'Tarifs', login: 'Connexion', signup: 'Inscription', dashboard: 'Tableau de bord', logout: 'Deconnexion' },
      hero: {
        badge: 'Pret pour la production sur Hedera Mainnet',
        title1: 'La Plateforme Notariale',
        title2: 'Intelligente avec une',
        title3: 'Confiance Indestructible',
        subtitle: "NotaryChain fusionne l'intelligence documentaire IA, la verification biometrique et l'integrite scellee par blockchain en une plateforme professionnelle.",
        cta_start: 'Commencer Gratuitement',
        cta_demo: 'Demo en Direct',
      },
      trust: { soc2: 'Conforme SOC2', hedera: 'Hedera Mainnet', ai: 'Propulse par IA', biometric: 'ID Biometrique' },
      auth: {
        sign_in: 'Connexion',
        sign_up: 'Inscription',
        email: 'Adresse Email',
        password: 'Mot de Passe',
        confirm_password: 'Confirmer le Mot de Passe',
        full_name: 'Nom Complet',
        forgot: 'Mot de passe oublie?',
        no_account: "Pas encore de compte?",
        has_account: 'Deja un compte?',
        or_continue: 'Ou continuer avec',
        welcome_back: 'Bon Retour',
        create_account: 'Creez Votre Compte',
      },
      dashboard: {
        title: 'Tableau de bord',
        welcome: 'Bon retour',
        documents: 'Documents',
        pending: 'En attente',
        completed: 'Termines',
        recent: 'Activite Recente',
      },
      common: { loading: 'Chargement...', save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', edit: 'Modifier', search: 'Rechercher', back: 'Retour' },
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
