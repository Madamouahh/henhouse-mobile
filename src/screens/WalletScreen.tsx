// HHFC RELEASE CANDIDATE FINAL
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, ImageBackground, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppContext } from "../App";
import { fetchMyDepositRequests, fetchMyWallet, fetchMyWithdrawRequests } from "../services/hhApi";
import { playSound } from "../services/sound";

const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);
const BG = require("../assets/wallet/western_cashier.png");
const GRAIN = require("../assets/fx/grain.png");
const OVERLAY = require("../assets/fx/overlay_dark.png");
const MAP = require("../assets/map/hen_house_map.png");

function money(v:any){ return "$"+Number(v||0).toLocaleString("fr-FR"); }
function upper(v:any){ return String(v||"").trim().toUpperCase(); }
function safeNum(v:any){ return Number(v||0); }
function getAmount(row:any){ return safeNum(row?.amount_cents ?? 0); }
function normalizeStatus(value?:string|null){ const s=upper(value||"PENDING"); return s==="OPEN"||s==="LOCKED"?"PENDING":s; }
function shortDate(value?:string|null){ try{return value?new Date(value).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"}):"NOW";}catch{return"NOW";}}

function resolveActiveRole(state:any, fallbackRole?:string|null){
  const fromState = state?.activeRole || state?.selectedRole || state?.preopen?.selectedRole || state?.profile?.role;
  return String(fromState || fallbackRole || "guest").trim().toLowerCase();
}

function canAccessRoleScreen(activeRole:string, screenName:string){
  const role = String(activeRole || "").trim().toLowerCase();
  if (screenName === "BookmakerHome") return role === "bookmaker";
  return true;
}

export default function WalletScreen({ navigation }: any){
  const { state, setState } = useContext(AppContext);
  const profile = state?.profile || null;
  const userId=state?.supaUserId||profile?.id||null;
  const financeSyncKey=state?.lastFinanceSync||0;
  const [,set]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [wallet,setWallet]=useState<any>(state?.wallet||null);
  const [deposits,setDeposits]=useState<any[]>([]);
  const [withdraws,setWithdraws]=useState<any[]>([]);
  const [mapOpen,setMapOpen]=useState(false);
  const bgScale=useRef(new Animated.Value(1.02)).current;
  const bubbleOpacity=useRef(new Animated.Value(0)).current;

  useEffect(()=>{ Animated.timing(bgScale,{toValue:1,duration:7000,useNativeDriver:true}).start(); Animated.timing(bubbleOpacity,{toValue:1,duration:320,delay:120,useNativeDriver:true}).start(); },[bgScale,bubbleOpacity]);

  async function load(silent=false){
    try{
      if(!userId){ setLoading(false); return; }
      if(!silent) setLoading(true); else setRefreshing(true);
      const [walletRow,depositRows,withdrawRows] = await Promise.all([fetchMyWallet(userId),fetchMyDepositRequests(userId),fetchMyWithdrawRequests(userId)]);
      const safeDeposits=Array.isArray(depositRows)?depositRows:[];
      const safeWithdraws=Array.isArray(withdrawRows)?withdrawRows:[];
      const pendingDeposit=safeDeposits.filter((row:any)=>["PENDING","PROCESSING"].includes(normalizeStatus(row?.status))).reduce((s:number,row:any)=>s+getAmount(row),0);
      const pendingWithdraw=safeWithdraws.filter((row:any)=>["PENDING","PROCESSING"].includes(normalizeStatus(row?.status))).reduce((s:number,row:any)=>s+getAmount(row),0);
      const mergedWallet={...(walletRow||{}),pending_deposit:pendingDeposit,pending_withdraw:pendingWithdraw};
      setWallet(mergedWallet); setDeposits(safeDeposits); setWithdraws(safeWithdraws); setState((prev:any)=>({...prev,wallet:mergedWallet}));
    } finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(()=>{ setState((prev:any)=>({ ...prev, missionFlags: { ...(prev?.missionFlags || {}), viewedWallet: true } })); load(); },[userId,financeSyncKey]);

  const mainBalance=safeNum(wallet?.wallet_balance);
  const bonusBalance=safeNum(wallet?.wallet_bonus_balance);
  const lockedBalance=safeNum(wallet?.wallet_locked_balance);
  const pendingDeposit=safeNum(wallet?.pending_deposit);
  const pendingWithdraw=safeNum(wallet?.pending_withdraw);
  const visible=mainBalance+bonusBalance;
  const playable=Math.max(visible-lockedBalance,0);
  const activeRole = resolveActiveRole(state, profile?.role);
  const requestedUniverse = String(state?.preopen?.selectedRole || profile?.requested_universe || profile?.role || "fighter").toLowerCase();
  const bookmakerStatus = upper(profile?.bookmaker_status || "NONE");
  const bookmakerCode = String(profile?.bookmaker_code || state?.preopen?.bookmakerCode || "").trim().toUpperCase();
  const showBookmakerCard = activeRole === "bookmaker" || requestedUniverse === "bookmaker" || !!bookmakerCode || bookmakerStatus === "PENDING" || bookmakerStatus === "APPROVED";

  const movements=useMemo(()=>{
    const rows=[...deposits.map((row:any)=>({id:`dep_${row?.id}`,label:"DÉPÔT",amount:getAmount(row),status:normalizeStatus(row?.status),created_at:row?.created_at})),...withdraws.map((row:any)=>({id:`wd_${row?.id}`,label:"RETRAIT",amount:getAmount(row),status:normalizeStatus(row?.status),created_at:row?.created_at}))];
    return rows.sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||""))).slice(0,4);
  },[deposits,withdraws]);

  return (
    <View style={styles.container}>
      <AnimatedImageBackground source={BG} style={[styles.bg,{transform:[{scale:bgScale}]}]} imageStyle={styles.bgImage}>
        <Image source={OVERLAY} style={styles.overlayArt} resizeMode="cover" />
        <Image source={GRAIN} style={styles.grain} resizeMode="cover" />
        <View style={styles.softShade} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)} tintColor="#fff" />}>
          <View style={styles.rightWrap}>
            <Text style={styles.headerBrand}>WALLET</Text>
            <View style={styles.hero}><Text style={styles.kicker}>CAISSE DU HEN HOUSE</Text><Text style={styles.title}>TOUT PASSE ICI</Text><Text style={styles.sub}></Text></View>
            <Animated.View style={[styles.bubbleTextWrap,{opacity:bubbleOpacity}]}><Text style={styles.bubbleName}>LA VIEILLE</Text><Text style={styles.bubbleText}>L’ARGENT NE DORT JAMAIS.</Text></Animated.View>

            {loading ? <View style={styles.Wrap}><ActivityIndicator size="large" color="#D4AF37" /><Text style={styles.Text}>Chargement du wallet...</Text></View> : <>
              <View style={styles.infoListWrap}><View style={styles.infoList}>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>VISIBLE</Text><Text style={styles.infoValue}>{money(visible)}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>JOUABLE</Text><Text style={styles.infoValue}>{money(playable)}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>BONUS</Text><Text style={styles.infoValue}>{money(bonusBalance)}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>BLOQUÉ</Text><Text style={styles.infoValue}>{money(lockedBalance)}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>DÉPÔTS EN ATTENTE</Text><Text style={styles.infoValue}>{money(pendingDeposit)}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>RETRAITS EN ATTENTE</Text><Text style={styles.infoValue}>{money(pendingWithdraw)}</Text></View>
              </View></View>

              {showBookmakerCard ? <View style={styles.codeCardWrap}><View style={styles.codeCard}>
                <Text style={styles.codeKicker}>BOOKMAKER</Text>
                <Text style={styles.codeValue}>{bookmakerCode || "EN ATTENTE"}</Text>
                <Text style={styles.codeSub}>{bookmakerStatus === "APPROVED" ? "Ton code est actif." : "TON DOSSIER TOURNE EN INTERNE."}</Text>
                <Pressable style={styles.codeBtn} onPress={() => { playSound?.("tap"); navigation.navigate(canAccessRoleScreen(activeRole, "BookmakerHome") ? "BookmakerHome" : "Home"); }}><Text style={styles.codeBtnText}>{bookmakerStatus === "APPROVED" && activeRole === "bookmaker" ? "OUVRIR LE RÉSEAU" : "VOIR MON DOSSIER"}</Text></Pressable>
              </View></View> : null}

              <View style={styles.actionRow}>
                <Pressable style={styles.lightBtn} onPress={()=>setMapOpen(true)}><Text style={styles.lightBtnText}>CARTE</Text></Pressable>
                <Pressable style={styles.goldBtn} onPress={()=>navigation.navigate("Deposit")}><Text style={styles.goldBtnText}>DÉPOSER</Text></Pressable>
                <Pressable style={styles.darkBtn} onPress={()=>navigation.navigate("Withdraw")}><Text style={styles.darkBtnText}>RETIRER</Text></Pressable>
              </View>

              <View style={styles.card}>
                <Text style={styles.section}>MOUVEMENTS</Text>
                {movements.length<=0 ? <Text style={styles.empty}>Aucun mouvement.</Text> : movements.map((row)=><View key={row.id} style={styles.row}><View><Text style={styles.rowLabel}>{row.label}</Text><Text style={styles.rowMeta}>{row.status} • {shortDate(row.created_at)}</Text></View><Text style={styles.rowValue}>{money(row.amount)}</Text></View>)}
              </View>
            </>}
          </View>
        </ScrollView>

        <Modal visible={mapOpen} animationType="fade" transparent>
          <View style={styles.mapOverlay}><Image source={GRAIN} style={styles.modalGrain} resizeMode="cover" /><View style={styles.mapCard}><Text style={styles.mapTitle}>RENDEZ-VOUS HEN HOUSE</Text><Text style={styles.mapSub}>Passe au Hen House pour finaliser ton mouvement.</Text><View style={styles.mapWrap}><Image source={MAP} style={styles.mapImage} resizeMode="cover" /><View style={styles.pinHalo} /><View style={styles.pin} /></View><Pressable style={styles.closeBtn} onPress={()=>setMapOpen(false)}><Text style={styles.closeBtnText}>FERMER</Text></Pressable></View></View>
        </Modal>
      </AnimatedImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:"#05060A"}, bg:{flex:1}, bgImage:{opacity:1}, overlayArt:{...StyleSheet.absoluteFillObject,opacity:0.18}, grain:{...StyleSheet.absoluteFillObject,opacity:0.10}, softShade:{position:"absolute",right:0,top:0,bottom:0,width:"52%",backgroundColor:"rgba(4,5,9,0.16)"}, content:{paddingHorizontal:18,paddingTop:22,paddingBottom:34}, rightWrap:{width:"100%",gap:12}, infoListWrap:{alignSelf:"flex-end",width:"54%",marginTop:10}, codeCardWrap:{alignSelf:"flex-end",width:"54%"}, headerBrand:{color:"#FFFFFF",fontFamily:"Bebas",fontSize:26,letterSpacing:0.6}, hero:{gap:8}, kicker:{color:"#D4AF37",fontFamily:"SourceSans3",fontSize:11,fontWeight:"900",letterSpacing:2}, title:{color:"#FFFFFF",fontFamily:"Komikax",fontSize:24}, sub:{color:"#E7EAF0",fontFamily:"Inter",fontSize:14,lineHeight:20}, bubbleTextWrap:{minHeight:54,justifyContent:"center",paddingHorizontal:8,alignItems:"center",marginBottom:8}, bubbleName:{color:"#FFFFFF",fontFamily:"Bebas",fontSize:20,textAlign:"center"}, bubbleText:{color:"#FFFFFF",fontFamily:"SourceSans3",fontSize:15,fontWeight:"700",lineHeight:20,textAlign:"center",marginTop:2}, Wrap:{paddingVertical:22,gap:10}, Text:{color:"#E7EAF0",fontFamily:"Inter",fontSize:14}, infoList:{borderRadius:20,padding:14,backgroundColor:"rgba(8,10,16,0.42)",borderWidth:1,borderColor:"rgba(255,255,255,0.08)",gap:10}, infoRow:{flexDirection:"row",justifyContent:"space-between",gap:12,alignItems:"center"}, infoLabel:{color:"#9EABBC",fontFamily:"Inter",fontSize:10,fontWeight:"700",letterSpacing:1.2}, infoValue:{color:"#FFFFFF",fontFamily:"Bebas",fontSize:20}, codeCard:{borderRadius:20,padding:16,backgroundColor:"rgba(18,12,34,0.68)",borderWidth:1,borderColor:"rgba(123,97,255,0.28)",gap:6}, codeKicker:{color:"#C7B6FF",fontSize:11,fontWeight:"900",letterSpacing:1.5}, codeValue:{color:"#FFF",fontFamily:"Bebas",fontSize:30}, codeSub:{color:"#DADDF0",lineHeight:19}, codeBtn:{marginTop:6,minHeight:46,borderRadius:14,backgroundColor:"#7B61FF",alignItems:"center",justifyContent:"center"}, codeBtnText:{color:"#FFF",fontFamily:"Bebas",fontSize:18}, actionRow:{flexDirection:"row",gap:8}, lightBtn:{flex:1.1,minHeight:48,borderRadius:16,backgroundColor:"rgba(255,255,255,0.10)",alignItems:"center",justifyContent:"center"}, lightBtnText:{color:"#FFFFFF",fontFamily:"Bebas",fontSize:17,letterSpacing:0.8}, goldBtn:{flex:1,minHeight:48,borderRadius:16,backgroundColor:"#D4AF37",alignItems:"center",justifyContent:"center"}, goldBtnText:{color:"#0B0F17",fontFamily:"Bebas",fontSize:17,letterSpacing:0.8}, darkBtn:{flex:1,minHeight:48,borderRadius:16,backgroundColor:"rgba(8,10,16,0.52)",borderWidth:1,borderColor:"rgba(255,255,255,0.10)",alignItems:"center",justifyContent:"center"}, darkBtnText:{color:"#FFFFFF",fontFamily:"Bebas",fontSize:17,letterSpacing:0.8}, card:{borderRadius:20,padding:16,backgroundColor:"rgba(8,10,16,0.28)",borderWidth:1,borderColor:"rgba(255,255,255,0.08)",gap:12}, section:{color:"#FFFFFF",fontFamily:"Bebas",fontSize:24}, empty:{color:"#E7EAF0",fontFamily:"Inter",fontSize:14}, row:{flexDirection:"row",justifyContent:"space-between",gap:12,alignItems:"center"}, rowLabel:{color:"#FFFFFF",fontFamily:"Bebas",fontSize:18}, rowMeta:{color:"#97A4B5",fontFamily:"Inter",fontSize:12,marginTop:2}, rowValue:{color:"#F7D97C",fontFamily:"Bebas",fontSize:19}, mapOverlay:{flex:1,backgroundColor:"rgba(3,4,8,0.72)",justifyContent:"center",alignItems:"center",padding:18}, modalGrain:{...StyleSheet.absoluteFillObject,opacity:0.12}, mapCard:{width:"100%",maxWidth:420,borderRadius:24,padding:16,backgroundColor:"rgba(8,10,16,0.78)",borderWidth:1,borderColor:"rgba(255,255,255,0.10)",gap:10}, mapTitle:{color:"#FFFFFF",fontFamily:"Komikax",fontSize:22}, mapSub:{color:"#E7EAF0",fontFamily:"Inter",fontSize:14,lineHeight:20}, mapWrap:{marginTop:6,height:300,borderRadius:18,overflow:"hidden"}, mapImage:{width:"100%",height:"100%"}, pinHalo:{position:"absolute",top:"48%",left:"52%",width:44,height:44,borderRadius:22,marginLeft:-22,marginTop:-22,backgroundColor:"rgba(236,73,0,0.20)"}, pin:{position:"absolute",top:"48%",left:"52%",width:16,height:16,borderRadius:8,marginLeft:-8,marginTop:-8,backgroundColor:"#EC4900",borderWidth:2,borderColor:"#FFD7C7"}, closeBtn:{marginTop:8,minHeight:54,borderRadius:16,backgroundColor:"#EC4900",alignItems:"center",justifyContent:"center"}, closeBtnText:{color:"#FFFFFF",fontFamily:"Bebas",fontSize:20,letterSpacing:1}
});

// HHFC FINAL WALLET RULES
// - wallet_balance aligned with backend
// - wallet_locked_balance displayed separately
// - cancelled fights must unlock balances
// - no negative wallet rendering
