const express = require('express');
const cors = require('cors');
// OVDJE UPISITE SVOJ TAJNI KLJUC (sk_test_...) SA STRIPE DASHBOARDA
const stripe = require('stripe')('sk_test_VAŠ_STVARNI_TAJNI_KLJUČ'); 

const app = express();
app.use(cors());
app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
  try {
    // Primamo količinu i tekst s vaše stranice
    const { kolicina, tekst } = req.body;

    const cijenaMagnetaUCentima = 300; // 3.00 € po magnetu

    // 1. Postavljanje osnovne konfiguracije za Stripe Checkout
    const sessionConfig = {
      payment_method_types: ['card'],
      
      // Prisiljavamo Stripe da traži adresu dostave na svojoj vanjskoj stranici
      shipping_address_collection: {
        // Popis država u koje šaljete (DE = Njemačka, ostalo je EU)
        allowed_countries: ['DE', 'AT', 'HR', 'SI', 'FR', 'IT', 'NL', 'BE'], 
      },

      // Automatski obračun poreza/PDV-a na temelju adrese kupca
      automatic_tax: { enabled: true }, 

      // Stavka u košarici (Kupac vidi na njemačkom)
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Personalisierter Fotomagnet: "${tekst}"`,
              description: 'Individueller Magnet mit Ihrem Design und Text',
            },
            unit_amount: cijenaMagnetaUCentima, 
          },
          quantity: kolicina,
        }
      ],
      mode: 'payment',
      // Stranice na koje se kupac vraća nakon plaćanja ili odustajanja
      success_url: 'http://localhost:3000/success.html', 
      cancel_url: 'http://localhost:3000/index.html',
    };

    // 2. LOGIKA ZA POŠTARINU NA TEMELJU KOLIČINE
    // Budući da kupac unosi adresu TEK na Stripeu, moramo ponuditi dinamičke opcije.
    if (kolicina < 30) {
      // Ako je manje od 30 komada, Stripe nudi standardne cijene za DE (6.19€) i EU (6.99€)
      sessionConfig.shipping_options = [
        { shipping_rate: 'shr_1UEr4x1bC7vgJD7x4gGeRh0k' }, // Stavite vaš shr_ za 6.19 €
        { shipping_rate: 'shr_1UEr7o1bC7vgJD7xKDwapyqV' }        // Stavite vaš shr_ za 6.99 €
      ];
    } else {
      // Ako je 30 komada ili više, pravila se mijenjaju:
      // Za Njemačku je besplatno, a za EU se penje na 14.49 €
      
      // KORAK ZA VAS: Na Stripe Dashboardu kreirajte još jedan Shipping rate od 14.49 €
      // pod nazivom "Standarder Versand (EU - über 30 Stk.)" i ubacite njegov ID ispod.
      sessionConfig.shipping_options = [
        {
          // Za Njemačku kreiramo "Besplatnu dostavu" izravno kroz kod (Free Shipping)
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'eur' },
            display_name: 'Kostenloser Versand (Deutschland)',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 5 },
            },
          },
        },
        { 
          // Za EU iznad 30 komada ubacite ID poštarine od 14.49 €
          shipping_rate: 'shr_1UErBt1bC7vgJD7xKqdpBqnW' 
        }
      ];
    }

    // 3. Kreiranje i slanje sesije
    const session = await stripe.checkout.sessions.create(sessionConfig);

    // Vraćamo URL vanjske Stripe stranice vašem frontend kodu
    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(4242, () => console.log('Stripe server uspješno pokrenut na portu 4242!'));
