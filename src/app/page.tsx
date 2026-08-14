import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import BuiltBy from "@/components/BuiltBy";
import Products from "@/components/Products";
import ContractIntegrity from "@/components/ContractIntegrity";
import ValueProp from "@/components/ValueProp";
import Press from "@/components/Press";
import Metrics from "@/components/Metrics";
import Integrations from "@/components/Integrations";
import Trust from "@/components/Trust";
import Team from "@/components/Team";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <BuiltBy />
        <Press />
        <Products />
        <ContractIntegrity />
        <ValueProp />
        <Metrics />
        <Integrations />
        <Trust />
        <Team />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
