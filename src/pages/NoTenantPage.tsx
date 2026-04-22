import { supabase } from '../lib/supabase';

export default function NoTenantPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-secondary-background rounded-2xl border border-border/10 shadow-xl p-8 text-center">
        <h1 className="text-xl font-bold text-text-primary mb-2">Δεν βρέθηκε χώρος εργασίας</h1>
        <p className="text-sm text-text-secondary mb-6">
          Ο λογαριασμός σας δεν είναι συνδεδεμένος με κάποιον χώρο εργασίας. Ελέγξτε αν χρησιμοποιήσατε σύνδεσμο πρόσκλησης ή επικοινωνήστε με τον διαχειριστή σας.
        </p>
        <button
          onClick={() => supabase.auth.signOut().then(() => window.location.href = '/login')}
          className="btn-secondary w-full cursor-pointer"
        >
          Αποσύνδεση
        </button>
      </div>
    </div>
  );
}
