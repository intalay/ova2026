import logo from "@/assets/ova-5050.png.asset.json";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
export function LotteryModule(){return <div className="home-lottery"><div className="home-lottery-content"><div className="home-lottery-info"><img src={logo.url} alt="OVA 50/50" width={1024} height={284} className="lottery-logo w-40"/><p className="home-lottery-label">Winner took home</p><p className="home-prize font-display">$14,835</p></div><div className="home-lottery-cta"><Link to="/fifty-fifty" className="home-lottery-button">Get your tickets<ArrowRight aria-hidden className="size-5"/></Link><p className="home-lottery-legal">18+ · Ontario only</p></div></div></div>;}
