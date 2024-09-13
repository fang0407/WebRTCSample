package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type RoomTable struct {
	//{room_id: {uid : conn}}
	room map[string]map[string]*websocket.Conn
}

var room RoomTable = RoomTable{room: make(map[string]map[string]*websocket.Conn)}

func (this *RoomTable) Insert(room_id, uid string, conn *websocket.Conn) {
	uid_table, exists := this.room[room_id]
	if exists {
		if len(uid_table) > 1 {
			log.Printf("Insert to RoomTable err: room_id:%s, uid:%s\n", room_id, uid)
			return
		}
		uid_table[uid] = conn
	} else {
		this.room[room_id] = map[string]*websocket.Conn{uid: conn}
	}
}

func (this *RoomTable) Get(room_id string) (result map[string]*websocket.Conn) {
	uid_table, exists := this.room[room_id]
	if exists {
		result = uid_table
	} else {
		result = nil
	}
	return
}

func (this *RoomTable) Delete(room_id string) {
	delete(this.room, room_id)
}

func (this *RoomTable) Print() {
	for k, v := range this.room {
		log.Printf("room id:%s ", k)
		//conn指针其实只创建了一次，之后每一次遍历其实都只是将这个指针指向新的地址
		for k, conn := range v {
			log.Printf("uid:%s conn:%p", k, conn)
		}
		log.Println()
	}
}

func HandleJoinCmd(msg map[string]interface{}, conn *websocket.Conn) {
	room_id, _ := msg["roomId"].(string)
	uid, _ := msg["uid"].(string)

	log.Printf("uid: %s, try to join room id: %s\n", uid, room_id)
	//同一个用户加入同一个房间多次 没有处理
	room.Insert(room_id, uid, conn)
	// room.Print()

	//遍历RoomTable，2个uid时通知offer new-peer， 通知answer resp-join
	uid_table := room.Get(room_id)
	if uid_table == nil {
		return
	}

	if len(uid_table) < 2 {
		return
	}

	resp_map := make(map[string]interface{})
	resp_map["room_id"] = room_id
	for uid_tmp, conn_tmp := range uid_table {
		if uid_tmp != uid {
			resp_map["cmd"] = "resp-join"
			resp_map["remoteUid"] = uid_tmp

			resp_json, err := json.Marshal(resp_map)
			if err != nil {
				log.Panicln("json.Marshal err =", err)
				return
			}

			err = uid_table[uid].WriteMessage(websocket.TextMessage, resp_json)
			if err != nil {
				log.Panicln("uid_conn.WriteMesasge err =", err)
				return
			}

			log.Printf("join send resp-join message: %s\n", resp_json)

			resp_map["cmd"] = "new-peer"
			resp_map["remoteUid"] = uid

			resp_json, err = json.Marshal(resp_map)
			if err != nil {
				log.Panicln("json.Marshal err =", err)
				return
			}

			err = conn_tmp.WriteMessage(websocket.TextMessage, resp_json)
			if err != nil {
				log.Panicln("uid_conn.WriteMesasge err =", err)
				return
			}

			log.Printf("join send new-peer message: %s\n", resp_json)
		}
	}
}

func HandleOfferCmd(msg map[string]interface{}) {
	room_id, _ := msg["roomId"].(string)
	uid, _ := msg["uid"].(string)
	remoteUid, _ := msg["remoteUid"].(string)

	log.Printf("uid: %s, in room id: %s, try to offer remoteUid id: %s\n", uid, room_id, remoteUid)

	uid_table := room.Get(room_id)
	if uid_table == nil {
		return
	}

	remote_conn, exists := uid_table[remoteUid]
	if exists == false {
		return
	}

	resp_json, err := json.Marshal(msg)
	if err != nil {
		log.Panicln("json.Marshal err =", err)
		return
	}

	err = remote_conn.WriteMessage(websocket.TextMessage, resp_json)
	if err != nil {
		log.Panicln("remote_conn.WriteMesasge err =", err)
		return
	}

	//	log.Printf("offer send message: %s\n", resp_json)
	log.Printf("offer send message success\n")
}

func HandleAnswerCmd(msg map[string]interface{}) {
	room_id, _ := msg["roomId"].(string)
	uid, _ := msg["uid"].(string)
	remoteUid, _ := msg["remoteUid"].(string)

	log.Printf("uid: %s, in room id: %s, try to answer remoteUid id: %s\n", uid, room_id, remoteUid)

	uid_table := room.Get(room_id)
	if uid_table == nil {
		return
	}

	remote_conn, exists := uid_table[remoteUid]
	if exists == false {
		return
	}

	resp_json, err := json.Marshal(msg)
	if err != nil {
		log.Panicln("json.Marshal err =", err)
		return
	}

	err = remote_conn.WriteMessage(websocket.TextMessage, resp_json)
	if err != nil {
		log.Panicln("remote_conn.WriteMesasge err =", err)
		return
	}

	log.Printf("answer send message success\n")
}

func HandleCandidateCmd(msg map[string]interface{}) {
	room_id, _ := msg["roomId"].(string)
	uid, _ := msg["uid"].(string)
	remoteUid, _ := msg["remoteUid"].(string)

	log.Printf("uid: %s, in room id: %s, try to candidate remoteUid id: %s\n", uid, room_id, remoteUid)

	uid_table := room.Get(room_id)
	if uid_table == nil {
		return
	}

	remote_conn, exists := uid_table[remoteUid]
	if exists == false {
		return
	}

	resp_json, err := json.Marshal(msg)
	if err != nil {
		log.Panicln("json.Marshal err =", err)
		return
	}

	err = remote_conn.WriteMessage(websocket.TextMessage, resp_json)
	if err != nil {
		log.Panicln("remote_conn.WriteMesasge err =", err)
		return
	}

	log.Printf("condidate send message success\n")
}

func HandleLeaveCmd(msg map[string]interface{}) {
	room_id, _ := msg["roomId"].(string)
	uid, _ := msg["uid"].(string)

	log.Printf("uid: %s, try to leave room id: %s\n", uid, room_id)

	uid_table := room.Get(room_id)
	if uid_table == nil {
		return
	}

	for uid_tmp, conn_tmp := range uid_table {
		if uid_tmp != uid {
			resp_map := make(map[string]interface{})
			resp_map["cmd"] = "peer-leave"
			resp_map["remoteUid"] = uid

			resp_json, err := json.Marshal(resp_map)
			if err != nil {
				log.Panicln("json.Marshal err=", err)
				return
			}

			err = conn_tmp.WriteMessage(websocket.TextMessage, resp_json)
			if err != nil {
				log.Panicln("conn_tmp.WriteMessage err =", err)
				return
			} else {
				//delete leave
				delete(uid_table, uid)
			}
		}
	}

	if len(uid_table) == 0 {
		room.Delete(room_id)
	}
}

func HandleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Panicln("upgrader.Upgrade err =", err)
		return
	}
	defer conn.Close()

	log.Println("Client connected...")

	//用于异常关闭查找uid
	var room_id string
	for {
		msg_type, read_buf, err := conn.ReadMessage()
		if err != nil {
			log.Println("conn.ReadMessage err =", err, "message_type =", msg_type)
			if closeErr, ok := err.(*websocket.CloseError); ok {
				if closeErr.Code == websocket.CloseGoingAway {
					log.Printf("room id: %s, got error\n", room_id)
					if len(room_id) > 0 {
						uid_table := room.Get(room_id)
						if uid_table == nil {
							log.Panicf("room.Get room id :%s is empty\n", room_id)
							return
						}

						for uid_tmp, conn_tmp := range uid_table {
							if conn_tmp == conn {
								resp_map := make(map[string]interface{})
								resp_map["cmd"] = "leave"
								resp_map["uid"] = uid_tmp
								resp_map["roomId"] = room_id
								HandleLeaveCmd(resp_map)
							}
						}
					}
				}
			}
			return
		}

		if msg_type == websocket.TextMessage {
			var msg map[string]interface{}
			err := json.Unmarshal(read_buf, &msg)
			if err != nil {
				log.Panicln("json.Unmarshal err=", err)
				continue
			}
			//log.Printf("recv message: %s\n", string(read_buf))
			room_id = msg["roomId"].(string)
			switch cmd, _ := msg["cmd"].(string); cmd {
			case "join":
				HandleJoinCmd(msg, conn)
			case "offer":
				HandleOfferCmd(msg)
			case "answer":
				HandleAnswerCmd(msg)
			case "candidate":
				HandleCandidateCmd(msg)
			case "leave":
				HandleLeaveCmd(msg)
			}
		} else {
			log.Printf("websocket message type:%d\n", msg_type)
		}
	}
}

func main() {
	log.Println("signal server serve on 127.0.0.1:8010:/ws")

	http.HandleFunc("/ws", HandleConnection)
	err := http.ListenAndServe(":8010", nil)
	if err != nil {
		log.Panicln("http.ListenAndServe err =", err)
		return
	}
}
