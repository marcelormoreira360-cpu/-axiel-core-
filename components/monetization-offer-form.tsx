import { Button } from "@/components/button";
import { MONETIZATION_NOTE } from "@/modules/monetization/offer-defaults";

export function MonetizationOfferForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="space-y-4 rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div>
        <p className="text-sm font-semibold text-black/75">Create offer</p>
        <p className="mt-1 text-xs leading-5 text-black/45">Packages and memberships. Keep it simple.</p>
      </div>

      <label className="block text-sm font-semibold text-black/65">
        Name
        <input name="name" required placeholder="Example: 4 Session Package" className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25" />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-semibold text-black/65">
          Type
          <select name="offer_type" className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25">
            <option value="session_package">Session package</option>
            <option value="membership">Membership</option>
          </select>
        </label>
        <label className="block text-sm font-semibold text-black/65">
          Sessions
          <input name="number_of_sessions" type="number" min="1" max="500" required defaultValue="4" className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25" />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_110px]">
        <label className="block text-sm font-semibold text-black/65">
          Price
          <input name="price" type="number" min="0" step="0.01" required placeholder="0.00" className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25" />
        </label>
        <label className="block text-sm font-semibold text-black/65">
          Currency
          <input name="currency" defaultValue="USD" maxLength={3} className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm uppercase outline-none focus:border-black/25" />
        </label>
      </div>

      <label className="block text-sm font-semibold text-black/65">
        Description
        <textarea name="description" rows={3} placeholder="Optional internal description" className="mt-2 w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 text-sm outline-none focus:border-black/25" />
      </label>

      <div className="rounded-3xl bg-axiel-soft p-4 text-xs leading-5 text-black/50">{MONETIZATION_NOTE}</div>

      <Button className="min-h-14 w-full text-base">Save offer</Button>
    </form>
  );
}
