/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '480px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      fontSize: {
        'xs': ['0.5625rem', { lineHeight: '1.4' }],    // 9px (75% de 12px)
        'sm': ['0.625rem', { lineHeight: '1.4' }],     // 10px (75% de 13px)
        'base': ['0.6875rem', { lineHeight: '1.5' }],  // 11px (75% de 14px)
        'lg': ['0.75rem', { lineHeight: '1.4' }],      // 12px (75% de 16px)
        'xl': ['0.875rem', { lineHeight: '1.3' }],     // 14px (75% de 18px)
        '2xl': ['1rem', { lineHeight: '1.2' }],        // 16px (75% de 20px)
        '3xl': ['1.125rem', { lineHeight: '1.2' }],    // 18px (75% de 24px)
        '4xl': ['1.25rem', { lineHeight: '1.1' }],     // 20px (75% de 28px)
        '5xl': ['1.5rem', { lineHeight: '1.1' }],      // 24px (75% de 32px)
        '6xl': ['1.75rem', { lineHeight: '1' }],       // 28px (75% de 36px)
      },
      spacing: {
        '0.5': '0.09375rem', // 1.5px (75% de 2px)
        '1': '0.1875rem',    // 3px (75% de 4px)
        '1.5': '0.28125rem', // 4.5px (75% de 6px)
        '2': '0.375rem',     // 6px (75% de 8px)
        '2.5': '0.46875rem', // 7.5px (75% de 10px)
        '3': '0.5625rem',    // 9px (75% de 12px)
        '3.5': '0.65625rem', // 10.5px (75% de 14px)
        '4': '0.75rem',      // 12px (75% de 16px)
        '5': '0.9375rem',    // 15px (75% de 20px)
        '6': '1.125rem',     // 18px (75% de 24px)
        '7': '1.3125rem',    // 21px (75% de 28px)
        '8': '1.5rem',       // 24px (75% de 32px)
        '9': '1.6875rem',    // 27px (75% de 36px)
        '10': '1.875rem',    // 30px (75% de 40px)
        '11': '2.0625rem',   // 33px (75% de 44px)
        '12': '2.25rem',     // 36px (75% de 48px)
        '14': '2.625rem',    // 42px (75% de 56px)
        '16': '3rem',        // 48px (75% de 64px)
        '20': '3.75rem',     // 60px (75% de 80px)
        '24': '4.5rem',      // 72px (75% de 96px)
        '28': '5.25rem',     // 84px (75% de 112px)
        '32': '6rem',        // 96px (75% de 128px)
        '36': '6.75rem',     // 108px (75% de 144px)
        '40': '7.5rem',      // 120px (75% de 160px)
        '44': '8.25rem',     // 132px (75% de 176px)
        '48': '9rem',        // 144px (75% de 192px)
        '52': '9.75rem',     // 156px (75% de 208px)
        '56': '10.5rem',     // 168px (75% de 224px)
        '60': '11.25rem',    // 180px (75% de 240px)
        '64': '12rem',       // 192px (75% de 256px)
        '72': '13.5rem',     // 216px (75% de 288px)
        '80': '15rem',       // 240px (75% de 320px)
        '96': '18rem',       // 288px (75% de 384px)
      },
      // Reduzir espaçamentos padrão para serem mais compactos
      gap: {
        '0': '0px',
        '0.5': '0.09375rem', // 1.5px (75% de 2px)
        '1': '0.1875rem',    // 3px (75% de 4px)
        '1.5': '0.28125rem', // 4.5px (75% de 6px)
        '2': '0.375rem',     // 6px (75% de 8px)
        '2.5': '0.46875rem', // 7.5px (75% de 10px)
        '3': '0.5625rem',    // 9px (75% de 12px)
        '3.5': '0.65625rem', // 10.5px (75% de 14px)
        '4': '0.75rem',      // 12px (75% de 16px)
        '5': '0.9375rem',    // 15px (75% de 20px)
        '6': '1.125rem',     // 18px (75% de 24px)
        '7': '1.3125rem',    // 21px (75% de 28px)
        '8': '1.5rem',       // 24px (75% de 32px)
        '9': '1.6875rem',    // 27px (75% de 36px)
        '10': '1.875rem',    // 30px (75% de 40px)
        '11': '2.0625rem',   // 33px (75% de 44px)
        '12': '2.25rem',     // 36px (75% de 48px)
        '14': '2.625rem',    // 42px (75% de 56px)
        '16': '3rem',        // 48px (75% de 64px)
        '20': '3.75rem',     // 60px (75% de 80px)
        '24': '4.5rem',      // 72px (75% de 96px)
        '28': '5.25rem',     // 84px (75% de 112px)
        '32': '6rem',        // 96px (75% de 128px)
        '36': '6.75rem',     // 108px (75% de 144px)
        '40': '7.5rem',      // 120px (75% de 160px)
        '44': '8.25rem',     // 132px (75% de 176px)
        '48': '9rem',        // 144px (75% de 192px)
        '52': '9.75rem',     // 156px (75% de 208px)
        '56': '10.5rem',     // 168px (75% de 224px)
        '60': '11.25rem',    // 180px (75% de 240px)
        '64': '12rem',       // 192px (75% de 256px)
        '72': '13.5rem',     // 216px (75% de 288px)
        '80': '15rem',       // 240px (75% de 320px)
        '96': '18rem',       // 288px (75% de 384px)
      },
      // Reduzir padding e margin padrão
      padding: {
        '0': '0px',
        '0.5': '0.09375rem', // 1.5px (75% de 2px)
        '1': '0.1875rem',    // 3px (75% de 4px)
        '1.5': '0.28125rem', // 4.5px (75% de 6px)
        '2': '0.375rem',     // 6px (75% de 8px)
        '2.5': '0.46875rem', // 7.5px (75% de 10px)
        '3': '0.5625rem',    // 9px (75% de 12px)
        '3.5': '0.65625rem', // 10.5px (75% de 14px)
        '4': '0.75rem',      // 12px (75% de 16px)
        '5': '0.9375rem',    // 15px (75% de 20px)
        '6': '1.125rem',     // 18px (75% de 24px)
        '7': '1.3125rem',    // 21px (75% de 28px)
        '8': '1.5rem',       // 24px (75% de 32px)
        '9': '1.6875rem',    // 27px (75% de 36px)
        '10': '1.875rem',    // 30px (75% de 40px)
        '11': '2.0625rem',   // 33px (75% de 44px)
        '12': '2.25rem',     // 36px (75% de 48px)
        '14': '2.625rem',    // 42px (75% de 56px)
        '16': '3rem',        // 48px (75% de 64px)
        '20': '3.75rem',     // 60px (75% de 80px)
        '24': '4.5rem',      // 72px (75% de 96px)
        '28': '5.25rem',     // 84px (75% de 112px)
        '32': '6rem',        // 96px (75% de 128px)
        '36': '6.75rem',     // 108px (75% de 144px)
        '40': '7.5rem',      // 120px (75% de 160px)
        '44': '8.25rem',     // 132px (75% de 176px)
        '48': '9rem',        // 144px (75% de 192px)
        '52': '9.75rem',     // 156px (75% de 208px)
        '56': '10.5rem',     // 168px (75% de 224px)
        '60': '11.25rem',    // 180px (75% de 240px)
        '64': '12rem',       // 192px (75% de 256px)
        '72': '13.5rem',     // 216px (75% de 288px)
        '80': '15rem',       // 240px (75% de 320px)
        '96': '18rem',       // 288px (75% de 384px)
      },
      margin: {
        '0': '0px',
        '0.5': '0.09375rem', // 1.5px (75% de 2px)
        '1': '0.1875rem',    // 3px (75% de 4px)
        '1.5': '0.28125rem', // 4.5px (75% de 6px)
        '2': '0.375rem',     // 6px (75% de 8px)
        '2.5': '0.46875rem', // 7.5px (75% de 10px)
        '3': '0.5625rem',    // 9px (75% de 12px)
        '3.5': '0.65625rem', // 10.5px (75% de 14px)
        '4': '0.75rem',      // 12px (75% de 16px)
        '5': '0.9375rem',    // 15px (75% de 20px)
        '6': '1.125rem',     // 18px (75% de 24px)
        '7': '1.3125rem',    // 21px (75% de 28px)
        '8': '1.5rem',       // 24px (75% de 32px)
        '9': '1.6875rem',    // 27px (75% de 36px)
        '10': '1.875rem',    // 30px (75% de 40px)
        '11': '2.0625rem',   // 33px (75% de 44px)
        '12': '2.25rem',     // 36px (75% de 48px)
        '14': '2.625rem',    // 42px (75% de 56px)
        '16': '3rem',        // 48px (75% de 64px)
        '20': '3.75rem',     // 60px (75% de 80px)
        '24': '4.5rem',      // 72px (75% de 96px)
        '28': '5.25rem',     // 84px (75% de 112px)
        '32': '6rem',        // 96px (75% de 128px)
        '36': '6.75rem',     // 108px (75% de 144px)
        '40': '7.5rem',      // 120px (75% de 160px)
        '44': '8.25rem',     // 132px (75% de 176px)
        '48': '9rem',        // 144px (75% de 192px)
        '52': '9.75rem',     // 156px (75% de 208px)
        '56': '10.5rem',     // 168px (75% de 224px)
        '60': '11.25rem',    // 180px (75% de 240px)
        '64': '12rem',       // 192px (75% de 256px)
        '72': '13.5rem',     // 216px (75% de 288px)
        '80': '15rem',       // 240px (75% de 320px)
        '96': '18rem',       // 288px (75% de 384px)
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        positive: "hsl(var(--positive))",
        negative: "hsl(var(--negative))",
      },
      // Reduzir tamanhos de ícones e elementos
      width: {
        '0': '0px',
        '0.5': '0.09375rem', // 1.5px (75% de 2px)
        '1': '0.1875rem',    // 3px (75% de 4px)
        '1.5': '0.28125rem', // 4.5px (75% de 6px)
        '2': '0.375rem',     // 6px (75% de 8px)
        '2.5': '0.46875rem', // 7.5px (75% de 10px)
        '3': '0.5625rem',    // 9px (75% de 12px)
        '3.5': '0.65625rem', // 10.5px (75% de 14px)
        '4': '0.75rem',      // 12px (75% de 16px)
        '5': '0.9375rem',    // 15px (75% de 20px)
        '6': '1.125rem',     // 18px (75% de 24px)
        '7': '1.3125rem',    // 21px (75% de 28px)
        '8': '1.5rem',       // 24px (75% de 32px)
        '9': '1.6875rem',    // 27px (75% de 36px)
        '10': '1.875rem',    // 30px (75% de 40px)
        '11': '2.0625rem',   // 33px (75% de 44px)
        '12': '2.25rem',     // 36px (75% de 48px)
        '14': '2.625rem',    // 42px (75% de 56px)
        '16': '3rem',        // 48px (75% de 64px)
        '20': '3.75rem',     // 60px (75% de 80px)
        '24': '4.5rem',      // 72px (75% de 96px)
        '28': '5.25rem',     // 84px (75% de 112px)
        '32': '6rem',        // 96px (75% de 128px)
        '36': '6.75rem',     // 108px (75% de 144px)
        '40': '7.5rem',      // 120px (75% de 160px)
        '44': '8.25rem',     // 132px (75% de 176px)
        '48': '9rem',        // 144px (75% de 192px)
        '52': '9.75rem',     // 156px (75% de 208px)
        '56': '10.5rem',     // 168px (75% de 224px)
        '60': '11.25rem',    // 180px (75% de 240px)
        '64': '12rem',       // 192px (75% de 256px)
        '72': '13.5rem',     // 216px (75% de 288px)
        '80': '15rem',       // 240px (75% de 320px)
        '96': '18rem',       // 288px (75% de 384px)
      },
      height: {
        '0': '0px',
        '0.5': '0.09375rem', // 1.5px (75% de 2px)
        '1': '0.1875rem',    // 3px (75% de 4px)
        '1.5': '0.28125rem', // 4.5px (75% de 6px)
        '2': '0.375rem',     // 6px (75% de 8px)
        '2.5': '0.46875rem', // 7.5px (75% de 10px)
        '3': '0.5625rem',    // 9px (75% de 12px)
        '3.5': '0.65625rem', // 10.5px (75% de 14px)
        '4': '0.75rem',      // 12px (75% de 16px)
        '5': '0.9375rem',    // 15px (75% de 20px)
        '6': '1.125rem',     // 18px (75% de 24px)
        '7': '1.3125rem',    // 21px (75% de 28px)
        '8': '1.5rem',       // 24px (75% de 32px)
        '9': '1.6875rem',    // 27px (75% de 36px)
        '10': '1.875rem',    // 30px (75% de 40px)
        '11': '2.0625rem',   // 33px (75% de 44px)
        '12': '2.25rem',     // 36px (75% de 48px)
        '14': '2.625rem',    // 42px (75% de 56px)
        '16': '3rem',        // 48px (75% de 64px)
        '20': '3.75rem',     // 60px (75% de 80px)
        '24': '4.5rem',      // 72px (75% de 96px)
        '28': '5.25rem',     // 84px (75% de 112px)
        '32': '6rem',        // 96px (75% de 128px)
        '36': '6.75rem',     // 108px (75% de 144px)
        '40': '7.5rem',      // 120px (75% de 160px)
        '44': '8.25rem',     // 132px (75% de 176px)
        '48': '9rem',        // 144px (75% de 192px)
        '52': '9.75rem',     // 156px (75% de 208px)
        '56': '10.5rem',     // 168px (75% de 224px)
        '60': '11.25rem',    // 180px (75% de 240px)
        '64': '12rem',       // 192px (75% de 256px)
        '72': '13.5rem',     // 216px (75% de 288px)
        '80': '15rem',       // 240px (75% de 320px)
        '96': '18rem',       // 288px (75% de 384px)
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
} 